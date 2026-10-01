declare module 'tesseract.js' {
  export interface TesseractStatic {
    createWorker(): any;
    recognize(image: any): any;
    detect(image: any): any;
  }

  const Tesseract: TesseractStatic;
  export = Tesseract;
}
