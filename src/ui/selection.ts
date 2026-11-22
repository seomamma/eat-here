import { signal } from '@preact/signals';

/** Guest the player tapped (view sets it, UI shows its info card). Selection is not game state. */
export const selectedGuestId = signal<string | null>(null);

export function selectGuest(id: string | null): void {
  if (selectedGuestId.value !== id) selectedGuestId.value = id;
}
