/**
 * 复制文本到剪贴板，返回是否成功。
 *
 * 只用 navigator.clipboard 是不够的：
 * 1. 非安全上下文（http）下该 API 不存在；
 * 2. 页面在 iframe 内、或焦点不在文档上时，writeText 会以
 *    "Document is not focused" 拒绝，且不处理就完全静默。
 * 所以失败时回退到隐藏 textarea + execCommand('copy')。
 */
export async function copyText(text: string): Promise<boolean> {
  if (!text) return false;

  if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* 落到下面的兜底 */
    }
  }

  try {
    // execCommand 也要求文档有焦点，先试着把焦点拉回来
    try {
      window.focus();
    } catch {
      /* ignore */
    }

    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    // 固定定位 + 透明，避免触发页面滚动或闪烁
    area.style.position = 'fixed';
    area.style.top = '0';
    area.style.left = '0';
    area.style.width = '1px';
    area.style.height = '1px';
    area.style.padding = '0';
    area.style.border = '0';
    area.style.opacity = '0';
    area.style.pointerEvents = 'none';
    document.body.appendChild(area);

    const selection = document.getSelection();
    const previousRange =
      selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

    area.focus();
    area.select();
    // iOS Safari 只认 setSelectionRange
    area.setSelectionRange(0, text.length);

    const ok = document.execCommand('copy');
    document.body.removeChild(area);

    if (previousRange && selection) {
      selection.removeAllRanges();
      selection.addRange(previousRange);
    }
    return ok;
  } catch {
    return false;
  }
}
