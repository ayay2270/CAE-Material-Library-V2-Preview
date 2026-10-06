/** Visible production controls offer guidance; only a ready local editor can run the action. */
export function requestLocalEditing(editable: boolean, action: () => void, showGuidance: () => void): void {
  if (editable) action();
  else showGuidance();
}
