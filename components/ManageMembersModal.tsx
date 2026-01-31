import React, { useState } from 'react';
import { Users, X, UserPlus, UserMinus } from 'lucide-react';
import { User } from '../types';
import { AVATAR_POOL } from '../constants';

interface ManageMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: User[];
  setMembers: React.Dispatch<React.SetStateAction<User[]>>;
  currentUser: User;
}

const ManageMembersModal: React.FC<ManageMembersModalProps> = ({ isOpen, onClose, members, setMembers, currentUser }) => {
  const [newMemberName, setNewMemberName] = useState('');

  if (!isOpen) return null;

  const handleAddMember = () => {
    if (!newMemberName.trim()) return;
    const randomAvatar = AVATAR_POOL[Math.floor(Math.random() * AVATAR_POOL.length)];
    const newMember: User = {
      id: `user_${Date.now()}`,
      name: newMemberName,
      avatar: randomAvatar
    };
    setMembers([...members, newMember]);
    setNewMemberName('');
  };

  const handleRemoveMember = (id: string) => {
    if (members.length <= 1) {
      alert("至少要有一位成員！");
      return;
    }
    // 簡單防呆：不能刪除自己 (目前登入者)
    if (id === currentUser.id) {
      alert("不能將自己移出名單喔！");
      return;
    }
    if (window.confirm("確定要移除這位成員嗎？")) {
      setMembers(members.filter(m => m.id !== id));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#FFFEF5] w-full max-w-sm rounded-3xl shadow-xl overflow-hidden border-4 border-[#E0D8C0]">
        <div className="bg-[#7BC64F] p-4 flex justify-between items-center text-white">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Users size={20} /> 管理參加成員
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>
        
        <div className="p-5">
          <div className="flex gap-2 mb-4">
            <input 
              type="text" 
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              placeholder="輸入新成員名字"
              className="flex-1 bg-[#F9F7F2] border-2 border-[#E0D8C0] rounded-full px-4 py-2 text-sm focus:outline-none focus:border-[#7BC64F] text-[#5D4632]"
              onKeyDown={(e) => e.key === 'Enter' && handleAddMember()}
            />
            <button 
              onClick={handleAddMember}
              className="bg-[#7BC64F] text-white p-2.5 rounded-full hover:bg-[#5da135] shadow-sm flex-shrink-0 active:scale-95"
            >
              <UserPlus size={20} />
            </button>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {members.map(member => (
              <div key={member.id} className="flex items-center justify-between p-3 bg-white border border-[#E0D8C0] rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[#E9F5D8] rounded-full flex items-center justify-center border border-[#7BC64F] text-lg">
                    {member.avatar}
                  </div>
                  <span className="font-bold text-[#5D4632]">{member.name}</span>
                  {member.id === currentUser.id && (
                    <span className="text-[10px] bg-[#E0D8C0] text-[#5D4632] px-2 py-0.5 rounded-full">我自己</span>
                  )}
                </div>
                {member.id !== currentUser.id && (
                  <button 
                    onClick={() => handleRemoveMember(member.id)}
                    className="text-[#E0D8C0] hover:text-[#E76F51] p-2 rounded-full hover:bg-[#E76F51]/10 transition-colors"
                  >
                    <UserMinus size={18} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManageMembersModal;