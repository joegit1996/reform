export function buildDocumentScopeFilter(currentFocusId?: string | null): string {
  return currentFocusId ? `scope.eq.global,focus_id.eq.${currentFocusId}` : "scope.eq.global";
}

export function buildChatPayload(message: string, currentFocusId?: string | null): { focusId: string | null; message: string } {
  return {
    focusId: currentFocusId ?? null,
    message: message.trim()
  };
}

export function buildPlanSelection(currentFocusId?: string | null): { isActive: true; focusId: string | null } {
  return {
    isActive: true,
    focusId: currentFocusId ?? null
  };
}
