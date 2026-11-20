// Os três documentos da fase 1: perfil, preferências e avatar.
import { defineDoc } from "./docRepo";
import { AvatarV1, DEFAULT_AVATAR, DEFAULT_PREFS, PrefsV1, ProfileV1, type Avatar, type Prefs, type Profile } from "./schema/docs";
import { DOC_KINDS } from "./schema/kinds";

/** Sem padrão: não existir é a primeira visita. */
export const profileRepo = defineDoc<Profile>("profile", DOC_KINDS.profile.version, ProfileV1, null);
export const prefsRepo = defineDoc<Prefs>("prefs", DOC_KINDS.prefs.version, PrefsV1, DEFAULT_PREFS);
export const avatarRepo = defineDoc<Avatar>("avatar", DOC_KINDS.avatar.version, AvatarV1, DEFAULT_AVATAR);
