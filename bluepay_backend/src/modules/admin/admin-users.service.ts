import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import {
  User,
  UserDocument,
  UserRole,
} from '../users/schemas/user.schema';
import {
  StaffUser,
  StaffUserDocument,
} from '../staff/schemas/staff-user.schema';
import { SmartLiquidationService } from '../withdrawals/smart-liquidation.service';
import { SweepQueueService } from '../sweep/sweep-queue.service';
import { CryptoApisSubscriptionsService } from '../cryptoapis/cryptoapis-subscriptions.service';
import { AdjustBalanceDto, AdjustmentType } from './dto/adjust-balance.dto';
import { Deposit, DepositDocument } from '../deposits/schemas/deposit.schema';
import { Withdrawal, WithdrawalDocument, WithdrawalMethod, WithdrawalStatus } from '../withdrawals/schemas/withdrawal.schema';
import { MailerService } from '../two-factor/mailer.service';
import { DailyLogger } from '../../common/daily-logger';
import { AdminResetUserPasswordDto } from './dto/reset-user-password.dto';
import { IpActivity, IpActivityDocument } from '../ip-activity/schemas/ip-activity.schema';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as geoip from 'geoip-lite';

export interface ModerationResult {
  id: string;
  serialId?: string | null;
  name: string;
  email: string;
  role: UserRole;
  isBlocked: boolean;
  blockedAt: string | null;
  blockedBy: string | null;
  blockedReason: string | null;
  isFrozen: boolean;
  frozenAt: string | null;
  frozenBy: string | null;
  frozenReason: string | null;
  isOnWatch: boolean;
  watchedAt: string | null;
  watchedBy: string | null;
  watchedReason: string | null;
  smartUpiSelectionEnabled: boolean;
  loginLockedUntil?: string | null;
}

export interface AdminUserListItem extends ModerationResult {
  walletAddress: string | null;
  referralCode: string;
  phone: string | null;
  phoneUpdatedAt?: string | null;
  phoneUpdatedBy?: string | null;
  phoneUpdatedByName?: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  twoFactorVerified: boolean;
  twoFactorMethod: 'email' | 'phone' | null;
  totpEnabled: boolean;
  totpEnabledAt: string | null;
  createdAt: string | null;
  lastActiveAt?: string | null;
  invitedByDetails: {
    id: string;
    name: string;
    referralCode: string;
  } | null;
  isSubscribed: boolean;
  subscriptionStatus: string;
  subscriptionError: string | null;
}

export interface AdminUserListResult {
  items: AdminUserListItem[];
  total: number;
  page: number;
  limit: number;
}

export interface ListUsersOptions {
  page?: number;
  limit?: number;
  search?: string;
  role?: UserRole;
  blocked?: boolean;
  frozen?: boolean;
  onWatch?: boolean;
  smartUpi?: boolean;
}

@Injectable()
export class AdminUsersService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(StaffUser.name)
    private readonly staffUserModel: Model<StaffUserDocument>,
    @InjectModel(Deposit.name)
    private readonly depositModel: Model<DepositDocument>,
    @InjectModel(Withdrawal.name)
    private readonly withdrawalModel: Model<WithdrawalDocument>,
    @InjectModel(IpActivity.name)
    private readonly ipActivityModel: Model<IpActivityDocument>,
    private readonly smartLiquidation: SmartLiquidationService,
    private readonly sweepQueue: SweepQueueService,
    private readonly cryptoApisSubscriptions: CryptoApisSubscriptionsService,
    private readonly mailerService: MailerService,
  ) { }

  async assignAgent(
    targetId: string,
    agentId: string | null,
    adminId: string,
  ): Promise<ModerationResult & {
    assignedAgent: { id: string; fullName: string; email: string } | null;
  }> {
    if (!Types.ObjectId.isValid(targetId)) {
      throw new BadRequestException('Invalid user id');
    }
    const user = await this.userModel.findById(targetId);
    if (!user) throw new NotFoundException('User not found');

    if (agentId === null) {
      user.assignedAgent = null;
      user.assignedAgentAt = null;
      user.assignedAgentBy = null;
      user.assignedAgentSource = null;
    } else {
      const agent = await this.staffUserModel.findById(agentId);
      if (!agent || agent.isSuperAdmin || !agent.isActive) {
        throw new BadRequestException('Selected agent is not available');
      }
      user.assignedAgent = agent._id as Types.ObjectId;
      user.assignedAgentAt = new Date();
      user.assignedAgentBy = Types.ObjectId.isValid(adminId)
        ? new Types.ObjectId(adminId)
        : null;
      user.assignedAgentSource = 'admin';
    }
    await user.save();

    let assignedAgent: {
      id: string;
      fullName: string;
      email: string;
    } | null = null;
    if (user.assignedAgent) {
      const agent = await this.staffUserModel
        .findById(user.assignedAgent)
        .select('fullName email');
      if (agent) {
        assignedAgent = {
          id: (agent._id as Types.ObjectId).toString(),
          fullName: agent.fullName,
          email: agent.email,
        };
      }
    }
    return { ...await this.toListItemAsync(user), assignedAgent };
  }

  async setBlocked(
    targetId: string,
    isBlocked: boolean,
    adminId: string,
    reason?: string,
  ): Promise<ModerationResult> {
    const user = await this.loadTarget(targetId, adminId);
    if (user.role === UserRole.SuperAdmin) {
      throw new BadRequestException('Cannot block a super admin');
    }

    user.isBlocked = isBlocked;
    user.blockedAt = isBlocked ? new Date() : null;
    user.blockedBy = isBlocked ? new Types.ObjectId(adminId) : null;
    user.blockedReason = isBlocked ? reason ?? null : null;
    if (!isBlocked) {
      user.loginFailedAttempts = 0;
      user.loginLockedUntil = null;
    }
    await user.save();
    // A blocked user must not keep an armed Smart reservation (which the bridge
    // would otherwise keep announcing in Telegram). On unblock, reconcile re-arms.
    if (isBlocked) {
      await this.smartLiquidation.disarm(targetId);
    }
    return this.toResponse(user);
  }

  async setFrozen(
    targetId: string,
    isFrozen: boolean,
    adminId: string,
    reason?: string,
  ): Promise<ModerationResult> {
    const user = await this.loadTarget(targetId, adminId);
    if (user.role === UserRole.SuperAdmin) {
      throw new BadRequestException('Cannot freeze a super admin');
    }

    user.isFrozen = isFrozen;
    user.frozenAt = isFrozen ? new Date() : null;
    user.frozenBy = isFrozen ? new Types.ObjectId(adminId) : null;
    user.frozenReason = isFrozen ? reason ?? null : null;
    await user.save();
    // A frozen user must not keep an armed Smart reservation. On unfreeze,
    // reconcile re-arms if Smart is still enabled.
    if (isFrozen) {
      await this.smartLiquidation.disarm(targetId);
    }
    return this.toResponse(user);
  }

  async setOnWatch(
    targetId: string,
    isOnWatch: boolean,
    adminId: string,
    reason?: string,
  ): Promise<ModerationResult> {
    const user = await this.loadTarget(targetId, adminId);
    if (user.role === UserRole.SuperAdmin) {
      throw new BadRequestException('Cannot put a super admin on watch');
    }

    user.isOnWatch = isOnWatch;
    user.watchedAt = isOnWatch ? new Date() : null;
    user.watchedBy = isOnWatch ? new Types.ObjectId(adminId) : null;
    user.watchedReason = isOnWatch ? reason ?? null : null;
    await user.save();
    return this.toResponse(user);
  }

  async getById(
    id: string,
  ): Promise<
    AdminUserListItem & {
      assignedAgent: { id: string; fullName: string; email: string } | null;
    }
  > {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid user id');
    }
    const user = await this.userModel.findById(id);
    if (!user) throw new NotFoundException('User not found');

    let assignedAgent: {
      id: string;
      fullName: string;
      email: string;
    } | null = null;
    if (user.assignedAgent) {
      const agent = await this.staffUserModel
        .findById(user.assignedAgent)
        .select('fullName email');
      if (agent) {
        assignedAgent = {
          id: (agent._id as Types.ObjectId).toString(),
          fullName: agent.fullName,
          email: agent.email,
        };
      }
    }
    let lastActiveAt: string | null = null;
    try {
      const act = (await this.ipActivityModel.findOne({ userId: user._id }).sort({ createdAt: -1 }).select('createdAt')) as any;
      if (act && act.createdAt) {
        lastActiveAt = new Date(act.createdAt).toISOString();
      }
    } catch {
      // ignore
    }
    return { ...await this.toListItemAsync(user, lastActiveAt), assignedAgent };
  }

  async setReferral(
    targetId: string,
    referralCode: string | null | undefined,
    adminId: string,
  ): Promise<AdminUserListItem & {
    assignedAgent: { id: string; fullName: string; email: string } | null;
  }> {
    if (!Types.ObjectId.isValid(targetId)) {
      throw new BadRequestException('Invalid user id');
    }
    const user = await this.userModel.findById(targetId);
    if (!user) throw new NotFoundException('User not found');

    if (!referralCode) {
      user.invitedBy = null;
    } else {
      const codeUpper = referralCode.trim().toUpperCase();
      let inviterId: Types.ObjectId | null = null;
      let isStaffInviter = false;

      const userInviter = await this.userModel.findOne({ referralCode: codeUpper });
      if (userInviter) {
        inviterId = userInviter._id as Types.ObjectId;
      } else {
        const staffInviter = await this.staffUserModel.findOne({
          $or: [{ agentCode: codeUpper }, { username: codeUpper.toLowerCase() }],
        });
        if (staffInviter) {
          inviterId = staffInviter._id as Types.ObjectId;
          isStaffInviter = true;
        }
      }

      if (!inviterId) throw new NotFoundException('Referral code not found');
      if (inviterId.toString() === user._id.toString()) {
        throw new BadRequestException('User cannot refer themselves');
      }
      user.invitedBy = inviterId;
      if (isStaffInviter) {
        user.assignedAgent = inviterId;
      }
    }

    await user.save();
    return this.getById(targetId);
  }

  async adjustBalance(
    targetId: string,
    dto: AdjustBalanceDto,
    adminId: string,
  ): Promise<{ message: string; balanceChange: number }> {
    const user = await this.loadTarget(targetId, adminId);

    // Resolve admin name for the alert
    let adminName = 'Super Admin';
    if (Types.ObjectId.isValid(adminId)) {
      const staff = await this.staffUserModel.findById(adminId).select('fullName email isSuperAdmin');
      if (staff) {
        adminName = staff.isSuperAdmin ? 'Super Admin' : (staff.fullName || staff.email);
      } else {
        const adminUser = await this.userModel.findById(adminId).select('name email role');
        if (adminUser) {
          adminName = adminUser.role === UserRole.SuperAdmin ? 'Super Admin' : (adminUser.name || adminUser.email);
        }
      }
    }

    const username = user.serialId || user.email || (user._id ? user._id.toString() : 'Unknown');
    const name = user.name || 'User';

    if (dto.type === AdjustmentType.Credit) {
      const deposit = new this.depositModel({
        transactionId: `ADMIN_${crypto.randomBytes(8).toString('hex')}`,
        userId: user._id,
        walletAddress: user.walletAddress || 'MANUAL_ADJUSTMENT',
        amount: dto.amount,
        currency: 'USDT',
        timestamp: new Date(),
        rawPayload: { remark: dto.remark, adjustedBy: adminId },
      });
      await deposit.save();

      // if (user.walletAddress && user.walletAddress !== 'MANUAL_ADJUSTMENT') {
      //   void this.sweepQueue.enqueue(
      //     user.walletAddress,
      //     deposit._id as Types.ObjectId,
      //   );
      // }

      void DailyLogger.transactionAlert({
        type: 'Deposit',
        status: 'Confirmed (Admin Credit)',
        username,
        name,
        amount: `${dto.amount} USDT`,
        ipAddress: 'Admin Console',
        time: deposit.timestamp || new Date(),
        destinationOrWallet: deposit.walletAddress,
        txIdOrRef: deposit.transactionId,
        extraDetails: {
          'Source': 'Admin Manual Adjustment',
          'Credited By': adminName,
          ...(dto.remark ? { 'Remark': dto.remark } : {}),
        },
      }).catch((err) => {
        DailyLogger.error('Failed to send admin credit transaction alert', err?.stack, 'AdminUsersService');
      });

      return { message: 'Balance credited successfully', balanceChange: dto.amount };
    } else {
      const fxRate = 88.2;
      const netInr = Math.round(dto.amount * fxRate * 100) / 100;

      const withdrawal = new this.withdrawalModel({
        userId: user._id,
        method: WithdrawalMethod.Crypto,
        amount: dto.amount,
        feeRate: 0,
        fxRate: fxRate,
        feeUsdt: 0,
        netUsdt: dto.amount,
        grossInr: netInr,
        feeInr: 0,
        netInr: netInr,
        status: WithdrawalStatus.Paid,
        notes: dto.remark,
        processedBy: new Types.ObjectId(adminId),
        processedAt: new Date(),
        decisionReason: 'Manual debit by Admin',
      });
      await withdrawal.save();

      void DailyLogger.transactionAlert({
        type: 'Withdrawal',
        status: 'Paid (Admin Debit)',
        username,
        name,
        amount: `${dto.amount} USDT`,
        ipAddress: 'Admin Console',
        time: withdrawal.processedAt || new Date(),
        destinationOrWallet: user.walletAddress || 'Admin Manual Debit',
        txIdOrRef: (withdrawal._id as Types.ObjectId).toString(),
        extraDetails: {
          'Source': 'Admin Manual Adjustment',
          'Debited By': adminName,
          ...(dto.remark ? { 'Remark': dto.remark } : {}),
        },
      }).catch((err) => {
        DailyLogger.error('Failed to send admin debit transaction alert', err?.stack, 'AdminUsersService');
      });

      return { message: 'Balance debited successfully', balanceChange: -dto.amount };
    }
  }

  async listAll(opts: ListUsersOptions = {}): Promise<AdminUserListResult> {
    const page = Math.max(opts.page ?? 1, 1);
    const limit = Math.min(Math.max(opts.limit ?? 25, 1), 100);

    const filter: FilterQuery<UserDocument> = { role: UserRole.User };
    if (opts.role) filter.role = opts.role;
    if (typeof opts.blocked === 'boolean') filter.isBlocked = opts.blocked;
    if (typeof opts.frozen === 'boolean') filter.isFrozen = opts.frozen;
    if (typeof opts.onWatch === 'boolean') filter.isOnWatch = opts.onWatch;
    if (typeof opts.smartUpi === 'boolean') filter.smartUpiSelectionEnabled = opts.smartUpi;
    if (opts.search && opts.search.trim().length > 0) {
      const escaped = opts.search
        .trim()
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = new RegExp(escaped, 'i');
      filter.$or = [
        { name: rx },
        { email: rx },
        { walletAddress: rx },
        { referralCode: rx },
        { phone: rx },
      ];
    }

    const [docs, total] = await Promise.all([
      this.userModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.userModel.countDocuments(filter),
    ]);

    const userIds = docs.map((d) => d._id);
    const lastActiveMap = new Map<string, string>();
    try {
      const recentActivities = await this.ipActivityModel.aggregate([
        { $match: { userId: { $in: userIds } } },
        { $sort: { createdAt: -1 } },
        { $group: { _id: '$userId', lastActive: { $first: '$createdAt' } } },
      ]);
      for (const act of recentActivities) {
        if (act._id && act.lastActive) {
          lastActiveMap.set(act._id.toString(), new Date(act.lastActive).toISOString());
        }
      }
    } catch {
      // ignore
    }

    return {
      items: await Promise.all(docs.map((d) => this.toListItemAsync(d, lastActiveMap.get(d._id.toString())))),
      total,
      page,
      limit,
    };
  }

  private async toListItemAsync(u: UserDocument, lastActiveIso?: string | null): Promise<AdminUserListItem> {
    const createdAt = (u as unknown as { createdAt?: Date }).createdAt;
    let invitedByDetails: { id: string; name: string; referralCode: string; } | null = null;

    if (u.invitedBy) {
      const inviter = await this.userModel.findById(u.invitedBy).select('name referralCode');
      if (inviter) {
        invitedByDetails = {
          id: (inviter._id as Types.ObjectId).toString(),
          name: inviter.name,
          referralCode: inviter.referralCode,
        };
      } else {
        const staffInviter = await this.staffUserModel.findById(u.invitedBy).select('fullName agentCode username');
        if (staffInviter) {
          invitedByDetails = {
            id: (staffInviter._id as Types.ObjectId).toString(),
            name: staffInviter.fullName || staffInviter.username,
            referralCode: staffInviter.agentCode || staffInviter.username.toUpperCase(),
          };
        }
      }
    }

    const walletAddress = u.walletAddress?.trim() || '';
    const sub = walletAddress
      ? await this.cryptoApisSubscriptions.getSubscriptionStatus(walletAddress)
      : { status: 'not_found' as const, lastError: undefined };

    return {
      ...this.toResponse(u),
      walletAddress: u.walletAddress,
      referralCode: u.referralCode,
      phone: u.phone ?? null,
      phoneUpdatedAt: u.phoneUpdatedAt ? u.phoneUpdatedAt.toISOString() : null,
      phoneUpdatedBy: u.phoneUpdatedBy ? u.phoneUpdatedBy.toString() : null,
      phoneUpdatedByName: u.phoneUpdatedByName ?? null,
      emailVerified: u.emailVerified,
      phoneVerified: u.phoneVerified,
      twoFactorVerified: u.twoFactorVerified,
      twoFactorMethod: u.twoFactorMethod ?? null,
      totpEnabled: !!u.totpEnabled,
      totpEnabledAt: u.totpEnabledAt ? u.totpEnabledAt.toISOString() : null,
      createdAt: createdAt ? createdAt.toISOString() : null,
      lastActiveAt: lastActiveIso ?? null,
      invitedByDetails,
      isSubscribed: sub.status === 'active',
      subscriptionStatus: sub.status,
      subscriptionError: sub.lastError ?? null,
    };
  }

  private async loadTarget(
    targetId: string,
    adminId: string,
  ): Promise<UserDocument> {
    if (!Types.ObjectId.isValid(targetId)) {
      throw new BadRequestException('Invalid user id');
    }
    if (targetId === adminId) {
      throw new BadRequestException('Cannot moderate yourself');
    }
    const user = await this.userModel.findById(targetId);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async subscribeWallet(
    userId: string,
  ): Promise<{ message: string; status: string }> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user id');
    }
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    if (!user.walletAddress) {
      throw new BadRequestException('User does not have a wallet address');
    }

    const result = await this.cryptoApisSubscriptions.ensureSubscribed(
      user.walletAddress,
    );
    if (result === 'failed') {
      const sub = await this.cryptoApisSubscriptions.getSubscriptionStatus(
        user.walletAddress,
      );
      throw new BadRequestException(
        `Subscription failed: ${sub.lastError || 'Unknown error'}`,
      );
    }
    return {
      message:
        result === 'created'
          ? 'Wallet subscribed successfully'
          : 'Wallet is already subscribed',
      status: 'active',
    };
  }

  async setSmartUpi(
    targetId: string,
    enabled: boolean,
  ): Promise<ModerationResult> {
    if (!Types.ObjectId.isValid(targetId)) {
      throw new BadRequestException('Invalid user id');
    }
    const user = await this.userModel.findById(targetId);
    if (!user) throw new NotFoundException('User not found');
    user.smartUpiSelectionEnabled = enabled;
    await user.save();
    if (!enabled) {
      await this.smartLiquidation.disarm(targetId);
    }
    return this.toResponse(user);
  }

  private toResponse(u: UserDocument): ModerationResult {
    return {
      id: (u._id as Types.ObjectId).toString(),
      serialId: u.serialId ?? null,
      name: u.name,
      email: u.email,
      role: u.role,
      isBlocked: u.isBlocked,
      blockedAt: u.blockedAt ? u.blockedAt.toISOString() : null,
      blockedBy: u.blockedBy ? u.blockedBy.toString() : null,
      blockedReason: u.blockedReason ?? null,
      isFrozen: u.isFrozen,
      frozenAt: u.frozenAt ? u.frozenAt.toISOString() : null,
      frozenBy: u.frozenBy ? u.frozenBy.toString() : null,
      frozenReason: u.frozenReason ?? null,
      isOnWatch: u.isOnWatch,
      watchedAt: u.watchedAt ? u.watchedAt.toISOString() : null,
      watchedBy: u.watchedBy ? u.watchedBy.toString() : null,
      watchedReason: u.watchedReason ?? null,
      smartUpiSelectionEnabled: !!u.smartUpiSelectionEnabled,
      loginLockedUntil: u.loginLockedUntil ? u.loginLockedUntil.toISOString() : null,
    };
  }

  async resetUserPassword(
    targetId: string,
    dto: AdminResetUserPasswordDto,
    adminId: string,
  ): Promise<{ ok: boolean; message: string; email: string; temporaryPassword: string }> {
    if (!Types.ObjectId.isValid(targetId)) {
      throw new BadRequestException('Invalid user id');
    }
    const user = await this.userModel.findById(targetId);
    if (!user) throw new NotFoundException('User not found');
    if (!user.email) {
      throw new BadRequestException('User does not have a registered email address');
    }

    const tempPassword =
      dto.temporaryPassword?.trim() ||
      `Temp#${crypto.randomInt(100_000, 1_000_000)}`;

    user.passwordHash = await bcrypt.hash(tempPassword, 10);
    user.mustChangePassword = true;
    user.loginFailedAttempts = 0;
    user.loginLockedUntil = null;
    await user.save();

    DailyLogger.log(
      `[ADMIN] SuperAdmin (${adminId}) set temporary password for user=${user.email} (userId=${user._id})`,
      'AdminUsersService',
    );

    await this.mailerService.sendTemporaryPasswordEmail(user.email, tempPassword, user.name || 'User');

    return {
      ok: true,
      message: `Temporary password has been set and sent to ${user.email}`,
      email: user.email,
      temporaryPassword: tempPassword,
    };
  }

  async updatePhone(
    targetId: string,
    phone: string,
    adminId: string,
  ): Promise<
    AdminUserListItem & {
      assignedAgent: { id: string; fullName: string; email: string } | null;
    }
  > {
    if (!Types.ObjectId.isValid(targetId)) {
      throw new BadRequestException('Invalid user id');
    }
    const user = await this.userModel.findById(targetId);
    if (!user) throw new NotFoundException('User not found');

    let normalizedPhone = phone.trim();
    if (/^[6-9]\d{9}$/.test(normalizedPhone)) {
      normalizedPhone = `+91${normalizedPhone}`;
    }
    if (!/^\+91[6-9]\d{9}$/.test(normalizedPhone)) {
      throw new BadRequestException(
        'Phone must be a valid 10-digit Indian mobile number in +91XXXXXXXXXX format',
      );
    }

    const existing = await this.userModel.findOne({
      phone: normalizedPhone,
      _id: { $ne: user._id },
    });
    if (existing) {
      throw new ConflictException('Phone number is already registered with another user');
    }

    let adminName = 'Super Admin';
    if (Types.ObjectId.isValid(adminId)) {
      const staff = await this.staffUserModel.findById(adminId).select('fullName username');
      if (staff) {
        adminName = staff.fullName || staff.username;
      }
    }

    user.phone = normalizedPhone;
    user.phoneUpdatedAt = new Date();
    user.phoneUpdatedBy = new Types.ObjectId(adminId);
    user.phoneUpdatedByName = adminName;
    await user.save();

    DailyLogger.log(
      `[ADMIN] SuperAdmin (${adminId}, ${adminName}) updated phone for user=${user.email} (userId=${user._id}) to ${normalizedPhone}`,
      'AdminUsersService',
    );

    return this.getById(targetId);
  }

  async getUserLocations(period?: string): Promise<{
    totalActive: number;
    countries: Array<{
      countryCode: string;
      name: string;
      flag: string;
      count: number;
      percentage: number;
      coordinates: [number, number];
    }>;
    locations: Array<{
      id: string;
      userId: string;
      userName: string;
      country: string;
      countryCode: string;
      city: string;
      lat: number;
      lng: number;
      action: string;
      ip: string;
      updatedAt: string;
    }>;
  }> {
    let since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    if (period === 'Today') {
      since = new Date();
      since.setHours(0, 0, 0, 0);
    } else if (period === 'Last 7 Days') {
      since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === 'All Time') {
      since = new Date(0);
    }

    // 1. Fetch non-admin users
    const users = await this.userModel
      .find({ role: { $ne: UserRole.Admin } })
      .select('_id name email phone createdAt')
      .lean();

    const userMap = new Map<string, any>(users.map((u) => [u._id.toString(), u]));

    // 2. Fetch IP activities in period
    const activities = await this.ipActivityModel
      .find({
        createdAt: { $gte: since },
      })
      .sort({ createdAt: -1 })
      .limit(3000)
      .select('userId ipAddress actionType createdAt phone email details')
      .lean();

    const COUNTRY_META: Record<
      string,
      { name: string; flag: string; defaultCoord: [number, number] }
    > = {
      IN: { name: 'India', flag: '🇮🇳', defaultCoord: [20.5937, 78.9629] },
      US: { name: 'USA', flag: '🇺🇸', defaultCoord: [37.0902, -95.7129] },
      GB: { name: 'UK', flag: '🇬🇧', defaultCoord: [55.3781, -3.436] },
      CA: { name: 'Canada', flag: '🇨🇦', defaultCoord: [56.1304, -106.3468] },
      AE: { name: 'UAE', flag: '🇦🇪', defaultCoord: [23.4241, 53.8478] },
      SG: { name: 'Singapore', flag: '🇸🇬', defaultCoord: [1.3521, 103.8198] },
      AU: { name: 'Australia', flag: '🇦🇺', defaultCoord: [-25.2744, 133.7751] },
      DE: { name: 'Germany', flag: '🇩🇪', defaultCoord: [51.1657, 10.4515] },
      FR: { name: 'France', flag: '🇫🇷', defaultCoord: [46.2276, 2.2137] },
      JP: { name: 'Japan', flag: '🇯🇵', defaultCoord: [36.2048, 138.2529] },
      RU: { name: 'Russia', flag: '🇷🇺', defaultCoord: [61.524, 105.3188] },
      BR: { name: 'Brazil', flag: '🇧🇷', defaultCoord: [-14.235, -51.9253] },
      ZA: { name: 'South Africa', flag: '🇿🇦', defaultCoord: [-30.5595, 22.9375] },
      NG: { name: 'Nigeria', flag: '🇳🇬', defaultCoord: [9.082, 8.6753] },
      MY: { name: 'Malaysia', flag: '🇲🇾', defaultCoord: [4.2105, 101.9758] },
    };

    const resolveGeoFromPhone = (phone?: string | null): string | null => {
      if (!phone) return null;
      const clean = phone.replace(/[\s\-()]/g, '');
      if (clean.startsWith('+91') || clean.startsWith('91')) return 'IN';
      if (clean.startsWith('+1') || clean.startsWith('1')) return 'US';
      if (clean.startsWith('+44') || clean.startsWith('44')) return 'GB';
      if (clean.startsWith('+971')) return 'AE';
      if (clean.startsWith('+65')) return 'SG';
      if (clean.startsWith('+61')) return 'AU';
      if (clean.startsWith('+49')) return 'DE';
      if (clean.startsWith('+33')) return 'FR';
      if (clean.startsWith('+81')) return 'JP';
      if (clean.startsWith('+7')) return 'RU';
      if (clean.startsWith('+55')) return 'BR';
      if (clean.startsWith('+27')) return 'ZA';
      if (clean.startsWith('+234')) return 'NG';
      if (clean.startsWith('+60')) return 'MY';
      return null;
    };

    const userLocationMap = new Map<string, any>();
    const countryCounts = new Map<string, number>();

    // Process from real IP activities
    for (const act of activities) {
      const uId = act.userId ? act.userId.toString() : null;
      const u = uId ? userMap.get(uId) : null;
      const ip = act.ipAddress;

      let countryCode: string | null = null;
      let city = '';
      let lat = 0;
      let lng = 0;

      // 1. Try real GeoIP lookup
      if (ip && ip !== '127.0.0.1' && ip !== '::1' && ip !== 'localhost') {
        const geo = (geoip as any).lookup(ip);
        if (geo && geo.country) {
          countryCode = geo.country.toUpperCase();
          city = geo.city || '';
          if (geo.ll && Array.isArray(geo.ll) && geo.ll.length >= 2) {
            lat = geo.ll[0];
            lng = geo.ll[1];
          }
        }
      }

      // 2. If local or unresolved, fallback to user's phone prefix
      if (!countryCode) {
        countryCode = resolveGeoFromPhone(act.phone || u?.phone);
        if (countryCode && COUNTRY_META[countryCode]) {
          const meta = COUNTRY_META[countryCode];
          lat = meta.defaultCoord[0];
          lng = meta.defaultCoord[1];
          city = meta.name;
        }
      }

      // 3. Fallback to IN if still unmapped
      if (!countryCode) {
        countryCode = 'IN';
        lat = 20.5937;
        lng = 78.9629;
        city = 'India';
      }

      const key = uId || act.ipAddress;
      if (!userLocationMap.has(key)) {
        userLocationMap.set(key, {
          id: act._id?.toString() || key,
          userId: uId || '',
          userName: u?.name || act.email || 'User',
          country: COUNTRY_META[countryCode]?.name || countryCode,
          countryCode,
          city,
          lat,
          lng,
          action: act.actionType,
          ip: act.ipAddress,
          updatedAt: ((act as any).createdAt || new Date()).toISOString(),
        });
      }
    }

    // Include registered users not yet in activity log
    for (const u of users) {
      const uId = (u as any)._id.toString();
      if (!userLocationMap.has(uId)) {
        const countryCode = resolveGeoFromPhone(u.phone) || 'IN';
        const meta = COUNTRY_META[countryCode] || COUNTRY_META['IN'];
        userLocationMap.set(uId, {
          id: uId,
          userId: uId,
          userName: u.name || u.email || 'User',
          country: meta.name,
          countryCode,
          city: meta.name,
          lat: meta.defaultCoord[0],
          lng: meta.defaultCoord[1],
          action: 'registered',
          ip: '',
          updatedAt: ((u as any).createdAt || new Date()).toISOString(),
        });
      }
    }

    // Tally country counts
    for (const loc of userLocationMap.values()) {
      const code = loc.countryCode;
      countryCounts.set(code, (countryCounts.get(code) || 0) + 1);
    }

    const total = Array.from(countryCounts.values()).reduce((a, b) => a + b, 0);

    const sortedCountries = Array.from(countryCounts.entries())
      .map(([code, count]) => {
        const meta = COUNTRY_META[code] || {
          name: code,
          flag: '🌐',
          defaultCoord: [20, 0] as [number, number],
        };
        return {
          countryCode: code,
          name: meta.name,
          flag: meta.flag,
          count,
          percentage: total > 0 ? Math.round((count / total) * 100) : 0,
          coordinates: meta.defaultCoord,
        };
      })
      .sort((a, b) => b.count - a.count);

    return {
      totalActive: total,
      countries: sortedCountries,
      locations: Array.from(userLocationMap.values()).slice(0, 100),
    };
  }
}
