import "server-only";

import { resolve, sep } from "node:path";

export function photoStorageRoot() {
  const configured = process.env.FILE_STORAGE_ROOT;
  if (!configured) throw new Error("FILE_STORAGE_ROOT n'est pas configure.");
  return resolve(/* turbopackIgnore: true */ process.cwd(), configured);
}

export function resolvePrivatePhoto(relativePath: string) {
  const root = photoStorageRoot();
  const target = resolve(/* turbopackIgnore: true */ root, relativePath);
  if (target !== root && !target.startsWith(`${root}${sep}`)) throw new Error("Chemin de photo invalide.");
  return target;
}
