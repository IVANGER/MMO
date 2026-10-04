// Генераторы ID с префиксами

import { nanoid } from "nanoid";

export const newUserId      = () => "usr_"  + nanoid(10);
export const newToken       = () => "tok_"  + nanoid(24);
export const newCharId      = () => "chr_"  + nanoid(10);
export const newMobId       = () => "mob_"  + nanoid(10);
export const newItemId      = () => "item_" + nanoid(10);
export const newBagId       = () => "bag_"  + nanoid(10);
export const newLocationId  = () => "loc_"  + nanoid(10);
export const newRegionId    = () => "reg_"  + nanoid(10);
export const newNpcId       = () => "npc_"  + nanoid(10);
export const newObjectId    = () => "obj_"  + nanoid(10);
export const newFriendId    = () => "fr_"   + nanoid(10);
export const newChatId      = () => "chat_" + nanoid(10);
export const newGuildId     = () => "gld_"  + nanoid(10);
export const newAchId       = () => "ach_"  + nanoid(10);
export const newChallengeId = () => "chl_"  + nanoid(10);