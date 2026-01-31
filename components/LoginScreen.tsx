import React from 'react';
import { User as UserType } from '../types';

interface LoginScreenProps {
  members: UserType[];
  onLogin: (user: UserType) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ members, onLogin }) => {
  
  const handleUserSelect = (member: UserType) => {
    // Default login as normal user (isAdmin undefined or false)
    onLogin(member);
  };

  return (
    <div className="min-h-screen bg-[#E9F5D8] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Decoration */}
      <div className="absolute top-[-100px] right-[-100px] w-64 h-64 bg-[#7BC64F]/20 rounded-full blur-3xl"></div>
      <div className="absolute bottom-[-100px] left-[-100px] w-64 h-64 bg-[#F4A261]/20 rounded-full blur-3xl"></div>

      <div className="w-full max-w-md bg-[#FFFEF5] rounded-[40px] shadow-xl border-4 border-[#E0D8C0] overflow-hidden relative z-10 animate-fade-in">
        <div className="bg-[#7BC64F] p-8 text-center text-white relative overflow-hidden">
          <div className="relative z-10">
            <h1 className="text-3xl font-extrabold mb-2 tracking-tight">狸克的露營計畫</h1>
            <p className="text-[#F2CC8F] font-bold text-sm">請選擇您的身分登入</p>
          </div>
          <div className="absolute top-0 left-0 w-full h-full opacity-10" style={{backgroundImage: 'radial-gradient(#fff 2px, transparent 2px)', backgroundSize: '15px 15px'}}></div>
        </div>

        <div className="p-8">
          <div className="grid grid-cols-2 gap-4">
            {members.map(member => (
              <button
                key={member.id}
                onClick={() => handleUserSelect(member)}
                className="p-4 rounded-3xl border-2 border-[#E0D8C0] bg-white hover:border-[#7BC64F] hover:bg-[#F9F7F2] transition-all active:scale-95 flex flex-col items-center gap-2 group"
              >
                <div className="text-4xl w-16 h-16 flex items-center justify-center rounded-full border-2 border-[#7BC64F] bg-[#E9F5D8] shadow-sm transition-transform group-hover:scale-110">
                  {member.avatar}
                </div>
                <span className="font-bold text-[#5D4632] text-lg">{member.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#F9F7F2] border-t border-[#E0D8C0] flex justify-center items-center">
           <div className="text-xs text-[#8C7B65] font-bold opacity-70">
             v2.0 無人島移居版
           </div>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;