import { CloudRain } from 'lucide-react';
import { Bill, GearItem, Ingredient, User, TripInfo } from './types';

// REMOVED CURRENT_USER export. 
// User state is now managed in App.tsx and passed down via props.

export const TRIP_INFO: TripInfo = {
  title: '無人島移居計畫 (露營)',
  date: '12/25 - 12/27',
  location: '新竹縣五峰鄉 (海拔 1200m)',
  weather: { temp: '12°C', cond: '有雨', icon: CloudRain },
  albumUrl: '' // Default empty
};

export const INITIAL_MEMBERS: User[] = [
  { id: 'user_dad', name: '爸爸', avatar: '🐻' },
  { id: 'user_mom', name: '媽媽', avatar: '🐰' },
  { id: 'user_sis', name: '妹妹', avatar: '🐱' },
  { id: 'user_bro', name: '弟弟', avatar: '🐶' }
];

export const AVATAR_POOL = [
  // Animals
  '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', 
  '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🐤', '🦆', 
  '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', 
  '🐌', '🐞', '🐜', '🐢', '🐍', '🦎', '🦖', '🐙', '🦑', '🦐', 
  '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🦈', '🐊', '🐅',
  '🐆', '🦓', '🦍', '🦧', '🦣', '🐘', '🦛', '🦏', '🐪', '🐫',
  '🦒', '🦘', '🦬', '🐃', '🐂', '🐄', '🐎', '🐖', '🐑', '🐏',
  '🦙', '🐐', '🦌', '🐕', '🐩', '🦮', '🐈', '🐓', '🦃', '🦚',
  '🦜', '🦢', '🦩', '🕊️', '🐇', '🦝', '🦨', '🦡', '🦦', '🦥',
  '🐁', '🐀', '🐿️', '🦔', '🐾', '🐉', '🐲', 
  // Nature & Elements
  '🌵', '🎄', '🌲', '🌳', '🌴', '🌱', '🌿', '☘️', '🍀', '🎍', 
  '🎋', '🍃', '🍂', '🍁', '🍄', '🐚', '🪨', '🪵', '🔥', '💧', 
  '☀️', '🌙', '⭐',
  // People & Characters
  '👶', '👧', '🧒', '👦', '👩', '🧑', '👨', '👩‍🦱', '👨‍🦱', '👩‍🦰',
  '👨‍🦰', '👱‍♀️', '👱', '👩‍🦳', '👨‍🦳', '👩‍🦲', '👨‍🦲', '🧔', '👵', '🧓',
  '👴', '👲', '👳', '🧕', '👮', '👷', '💂', '🕵️', '👩‍⚕️', '👨‍⚕️',
  '👩‍🌾', '👨‍🌾', '👩‍🍳', '👨‍🍳', '👩‍🎓', '👨‍🎓', '👩‍🎤', '👨‍🎤', '👩‍🏫', '👨‍🏫',
  '👩‍🏭', '👨‍🏭', '👩‍💻', '👨‍💻', '👩‍💼', '👨‍💼', '👩‍🔧', '👨‍🔧', '👩‍🔬', '👨‍🔬',
  '👩‍🎨', '👨‍🎨', '👩‍🚒', '👨‍🚒', '👩‍✈️', '👨‍✈️', '👩‍🚀', '👨‍🚀', '👩‍⚖️', '👨‍⚖️',
  '👰', '🤵', '👸', '🤴', '🦸', '🦹', '🤶', '🎅', '🧙', '🧝',
  '🧛', '🧟', '🧞', '🧜', '🧚', '👼', '🤰', '🤱', '🙇', '💁',
  '🙅', '🙆', '🙋', '🤦', '🤷', '🙎', '🙍', '💇', '💆', '🧖',
  '🧗', '🧘', '🏄', '🏊', '🚣', '🚴', '🚵'
];

export const INITIAL_GEAR: GearItem[] = [
  { id: 1, name: '一房一廳帳', category: 'public', owner: null, required: true },
  { id: 2, name: '雙口爐 (Iwatani)', category: 'public', owner: { id: 'user_mom', name: '媽媽' }, required: true }, 
  { id: 3, name: '大冰桶 (50L)', category: 'public', owner: null, required: true },
  { id: 4, name: '露營椅 x4', category: 'public', owner: null, required: true },
  { id: 5, name: '睡袋 (個人)', category: 'personal', owner: null, required: true, status: 'pending' },
  { id: 6, name: '盥洗用品', category: 'personal', owner: null, required: true, status: 'pending' },
];

export const INITIAL_INGREDIENTS: Ingredient[] = [
  { id: 1, name: '好市多牛肉片 (500g)', selected: false, usedInPlanId: null, owner: { id: 'user_dad', name: '爸爸', avatar: '🐻' } },
  { id: 2, name: '洋蔥 3 顆', selected: false, usedInPlanId: null, owner: { id: 'user_mom', name: '媽媽', avatar: '🐰' } },
  { id: 3, name: '辛拉麵 2 包', selected: false, usedInPlanId: null, owner: { id: 'user_dad', name: '爸爸', avatar: '🐻' } },
  { id: 4, name: '雞蛋 1 盒', selected: false, usedInPlanId: null, owner: { id: 'user_mom', name: '媽媽', avatar: '🐰' } },
  { id: 5, name: '五花肉條 (300g)', selected: false, usedInPlanId: null, owner: { id: 'user_dad', name: '爸爸', avatar: '🐻' } },
  { id: 6, name: '康寶濃湯包 (玉米)', selected: false, usedInPlanId: null, owner: { id: 'user_mom', name: '媽媽', avatar: '🐰' } },
  { id: 7, name: '全聯吐司 (半條)', selected: false, usedInPlanId: null, owner: { id: 'user_dad', name: '爸爸', avatar: '🐻' } },
  { id: 8, name: '好市多餐包 (1袋)', selected: false, usedInPlanId: null, owner: { id: 'user_mom', name: '媽媽', avatar: '🐰' } },
  { id: 9, name: '金牌啤酒 (6入)', selected: false, usedInPlanId: null, owner: { id: 'user_dad', name: '爸爸', avatar: '🐻' } },
  { id: 10, name: '礦泉水 (2000ml x 2)', selected: false, usedInPlanId: null, owner: { id: 'user_dad', name: '爸爸', avatar: '🐻' } },
];

export const INITIAL_BILLS: Bill[] = [
  { id: 1, payerId: 'user_dad', item: '營位訂金', amount: 2000, date: '12/01' },
  { id: 2, payerId: 'user_mom', item: '全聯採買食材', amount: 1500, date: '12/24' },
  { id: 3, payerId: 'user_dad', item: '好市多牛肉', amount: 800, date: '12/24' },
  { id: 4, payerId: 'user_dad', item: '大人飲料(啤酒)', amount: 300, date: '12/25' }, 
];