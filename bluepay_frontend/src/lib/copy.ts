export const copyText = async (text: string): Promise<boolean> => {
  if (!text) return false;

  // Try the modern Clipboard API first
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn("Clipboard API failed, trying fallback...", err);
    }
  }

  // Fallback for older browsers, WebViews, or non-secure contexts
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;

    // Make the textarea invisible and out of view to avoid scrolling
    textArea.style.position = "fixed";
    textArea.style.top = "-9999px";
    textArea.style.left = "-9999px";
    textArea.style.opacity = "0";

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    const successful = document.execCommand("copy");
    document.body.removeChild(textArea);
    
    return successful;
  } catch (err) {
    console.error("Fallback copy failed", err);
    return false;
  }
};
