// A vila: quais locais existem. A interface não toca no catálogo; passa por aqui.
import { findLocation, listLocations } from "../catalog";
import type { Location } from "../schemas";

export function getLocations(): readonly Location[] {
  return listLocations();
}

/** `undefined` para um id que não existe em content/world/locations.json. */
export function getLocation(id: string): Location | undefined {
  return findLocation(id);
}
