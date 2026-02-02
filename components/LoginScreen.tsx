import React, { useState } from 'react';
import { User as UserType } from '../types';
import { Shield, ArrowRight, X, Lock } from 'lucide-react';

interface LoginScreenProps {
  members: UserType[];
  onLogin: (user: UserType) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ members, onLogin }) => {
  const [adminPassword, setAdminPassword] = useState('');
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [selectedAdminUser, setSelectedAdminUser] = useState<UserType | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleUserSelect = (member: UserType) => {
    if (member.isAdmin) {
        setSelectedAdminUser(member);
        setIsPasswordModalOpen(true);
        setAdminPassword('');
        setErrorMsg('');
    } else {
        onLogin(member);
    }
  };

  const handleAdminLogin = () => {
      // Hardcoded simple password for the "Island Owner"
      if (adminPassword === 'young') {
          if (selectedAdminUser) {
              onLogin(selectedAdminUser);
          }
      } else {
          setErrorMsg('密碼錯誤！(提示：young)');
          setAdminPassword('');
      }
  };

  // Separate Admin and Normal Users
  const adminUsers = members.filter(m => m.isAdmin);
  const normalUsers = members.filter(m => !m.isAdmin);

  return (
    <div className="min-h-screen bg-[#E9F5D8] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Decoration */}
      <div className="absolute top-[-100px] right-[-100px] w-64 h-64 bg-[#7BC64F]/20 rounded-full blur-3xl"></div>
      <div className="absolute bottom-[-100px] left-[-100px] w-64 h-64 bg-[#F4A261]/20 rounded-full blur-3xl"></div>

      <div className="w-full max-w-md bg-[#FFFEF5] rounded-[40px] shadow-xl border-4 border-[#E0D8C0] overflow-hidden relative z-10 animate-fade-in flex flex-col max-h-[90vh]">
        <div className="bg-[#7BC64F] p-8 text-center text-white relative overflow-hidden shrink-0">
          <div className="relative z-10">
            <h1 className="text-3xl font-extrabold mb-2 tracking-tight">狸克的露營計畫</h1>
            <p className="text-[#F2CC8F] font-bold text-sm">請選擇您的身分登入</p>
          </div>
          <div className="absolute top-0 left-0 w-full h-full opacity-10" style={{backgroundImage: 'radial-gradient(#fff 2px, transparent 2px)', backgroundSize: '15px 15px'}}></div>
        </div>

        <div className="p-8 overflow-y-auto">
          {/* Admin Section */}
          {adminUsers.length > 0 && (
              <div className="mb-6">
                  <h3 className="text-xs font-bold text-[#E76F51] mb-2 uppercase tracking-wide flex items-center gap-1 justify-center">
                      <Shield size={12} fill="currentColor"/> 營地管理員 (島主)
                  </h3>
                  <div className="grid grid-cols-1 gap-4">
                    {adminUsers.map(member => (
                        <button
                            key={member.id}
                            onClick={() => handleUserSelect(member)}
                            className="p-3 rounded-2xl border-2 border-[#E76F51] bg-[#FFF0EB] hover:bg-[#FFE4DC] transition-all active:scale-95 flex items-center gap-4 group shadow-sm relative overflow-hidden"
                        >
                            <div className="text-3xl w-14 h-14 flex items-center justify-center rounded-full bg-white border-2 border-[#E76F51] shadow-sm z-10">
                                {member.avatar}
                            </div>
                            <div className="text-left z-10 flex-1">
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-[#E76F51] text-lg block">{member.name}</span>
                                    <Lock size={14} className="text-[#E76F51] opacity-50"/>
                                </div>
                                <span className="text-[10px] text-[#E76F51]/70 font-bold">需輸入密碼進入</span>
                            </div>
                            <div className="absolute right-0 top-0 h-full w-16 bg-gradient-to-l from-[#E76F51]/10 to-transparent"></div>
                        </button>
                    ))}
                  </div>
              </div>
          )}

          {/* Normal Users Section */}
          <div>
              {adminUsers.length > 0 && (
                  <h3 className="text-xs font-bold text-[#8C7B65] mb-2 uppercase tracking-wide text-center">
                      露營成員
                  </h3>
              )}
              <div className="grid grid-cols-2 gap-4">
                {normalUsers.map(member => (
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
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#F9F7F2] border-t border-[#E0D8C0] flex justify-center items-center shrink-0">
           <div className="text-xs text-[#8C7B65] font-bold opacity-70">
             v2.1 無人島移居版
           </div>
        </div>
      </div>

      {/* Password Modal */}
      {isPasswordModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
              <div className="bg-[#FFFEF5] w-full max-w-sm rounded-3xl p-6 shadow-2xl border-4 border-[#E76F51] relative">
                  <button 
                    onClick={() => setIsPasswordModalOpen(false)}
                    className="absolute top-4 right-4 text-[#8C7B65] hover:bg-[#E0D8C0]/50 rounded-full p-1"
                  >
                      <X size={20} />
                  </button>
                  
                  <div className="text-center mb-6">
                      <div className="w-16 h-16 bg-[#E76F51] rounded-full flex items-center justify-center text-white text-3xl mx-auto mb-3 shadow-md border-4 border-white">
                          {selectedAdminUser?.avatar}
                      </div>
                      <h3 className="font-bold text-xl text-[#5D4632]">歡迎回來，島主！</h3>
                      <p className="text-xs text-[#8C7B65] mt-1">請輸入密碼以進入管理模式</p>
                  </div>

                  <div className="space-y-3">
                      <input 
                          type="password"
                          value={adminPassword}
                          onChange={(e) => {
                              setAdminPassword(e.target.value);
                              setErrorMsg('');
                          }}
                          placeholder="請輸入密碼"
                          autoFocus
                          className="w-full bg-white border-2 border-[#E0D8C0] rounded-xl px-4 py-3 text-center text-lg font-bold text-[#5D4632] focus:outline-none focus:border-[#E76F51]"
                          onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
                      />
                      {errorMsg && (
                          <div className="text-center text-xs text-[#E76F51] font-bold animate-pulse">
                              {errorMsg}
                          </div>
                      )}
                      <button 
                          onClick={handleAdminLogin}
                          className="w-full bg-[#E76F51] text-white py-3 rounded-xl font-bold shadow-md hover:bg-[#D65F41] active:scale-95 transition-all flex justify-center items-center gap-2"
                      >
                          登入 <ArrowRight size={18} />
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default LoginScreen;