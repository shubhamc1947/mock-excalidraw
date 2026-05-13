import { customAlphabet } from 'nanoid';
const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const slugger = customAlphabet(ALPH, 8);
export const newPublicSlug = () => slugger();
