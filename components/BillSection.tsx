import React, { useState, useEffect } from 'react';
import { Calculator, Plus, ArrowRightLeft, Trash2, Wallet } from 'lucide-react';
import { Bill, User } from '../types';

interface BillSectionProps {
  bills: Bill[];
  setBills: React.Dispatch<React.SetStateAction<Bill[]>>;
  members: User[];
  currentUser: User;
}

const BillSection: React.FC<BillSectionProps> = ({ bills, setBills, members, currentUser }) => {
  const [payerId, setPayerId] = useState(currentUser.id || members[0]?.id || ''); 
  const [item, setItem] = useState('');
  const [amount, setAmount] = useState('');

  // Update default payer to current user if possible
  useEffect(() => {
    if (currentUser && members.some(m => m.id === currentUser.id)) {
        setPayerId(currentUser.id);
    } else if (members.length > 0) {
        setPayerId(members[0].id);
    }
  }, [members, currentUser]);

  const handleAddBill = () => {
    if (!item.trim() || !amount) return;
    
    const newBill: Bill = {
      id: Date.now(),
      payerId,
      item,
      amount: parseInt(amount),
      date: new Date().toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' })
    };
    
    setBills([newBill, ...bills]);
    setItem('');
    setAmount('');
  };

  const handleDeleteBill = (id: number) => {
    if(window.confirm("確定刪除這筆帳目嗎？")) {
      setBills(bills.filter(b => b.id !== id));
    }
  };

  const totalExpense = bills.reduce((sum, b) => sum + b.amount, 0);
  const averageExpense = members.length > 0 ? Math.round(totalExpense / members.length) : 0;

  const memberStatus = members.map(member => {
    const paid = bills
      .filter(b => b.payerId === member.id)
      .reduce((sum, b) => sum + b.amount, 0);
    
    const balance = paid - averageExpense; 

    return { ...member, paid, balance };
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-[#F2CC8F] rounded-3xl p-5 text-[#5D4632] shadow-lg border-4 border-white">
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-[#8C7B65] text-xs font-bold uppercase tracking-wide mb-1">本次露營總鈴錢</p>
            <h2 className="text-3xl font-extrabold flex items-center gap-1">
              <span className="text-2xl">$</span>
              {totalExpense.toLocaleString()}
            </h2>
          </div>
          <div className="text-right">
            <p className="text-[#8C7B65] text-xs font-bold uppercase tracking-wide mb-1">每人平均</p>
            <h2 className="text-xl font-bold flex items-center justify-end gap-1">
              ${averageExpense.toLocaleString()}
              <span className="text-xs font-normal opacity-70">/ {members.length}人</span>
            </h2>
          </div>
        </div>
        
        <div className="bg-white/40 rounded-2xl p-4 backdrop-blur-sm border border-white/50">
          <div className="flex items-center gap-2 mb-3 text-sm font-bold text-[#5D4632]">
            <Calculator size={16} /> 鈴錢結算 (多退少補)
          </div>
          <div className="space-y-2">
            {memberStatus.map(m => (
              <div key={m.id} className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{m.avatar}</span>
                  <span className="font-bold opacity-90">{m.name}</span>
                </div>
                
                {m.balance > 0 ? (
                  <div className="flex items-center gap-1 text-[#2A9D8F] font-bold bg-[#2A9D8F]/10 px-2 py-0.5 rounded-full">
                    <span className="text-xs font-normal">應收回</span>
                    +${m.balance.toLocaleString()}
                  </div>
                ) : m.balance < 0 ? (
                  <div className="flex items-center gap-1 text-[#E76F51] font-bold bg-[#E76F51]/10 px-2 py-0.5 rounded-full">
                    <span className="text-xs font-normal">需支付</span>
                    ${Math.abs(m.balance).toLocaleString()}
                  </div>
                ) : (
                  <div className="text-xs opacity-70 bg-white/50 px-2 py-0.5 rounded-full">收支平衡</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-[#FFFEF5] p-5 rounded-3xl shadow-sm border border-[#E0D8C0]">
        <h3 className="font-bold text-[#5D4632] flex items-center gap-2 mb-4">
          <Plus size={20} className="text-[#F4A261]" />
          記一筆帳
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#8C7B65] mb-2">誰先墊的錢</label>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {members.map(member => (
                <button
                  key={member.id}
                  onClick={() => setPayerId(member.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-all whitespace-nowrap border-2 active:scale-95 ${
                    payerId === member.id 
                      ? 'bg-[#E76F51] text-white border-[#E76F51] font-bold shadow-sm' 
                      : 'bg-white text-[#8C7B65] border-[#E0D8C0] hover:border-[#F4A261]'
                  }`}
                >
                  {member.avatar} {member.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="block text-xs font-bold text-[#8C7B65] mb-1">買了什麼</label>
              <input 
                type="text" 
                value={item}
                onChange={(e) => setItem(e.target.value)}
                placeholder="例如: 營位費"
                className="w-full bg-[#F9F7F2] border-2 border-[#E0D8C0] rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-[#F4A261] text-[#5D4632]"
              />
            </div>
            <div className="w-full sm:w-1/3">
              <label className="block text-xs font-bold text-[#8C7B65] mb-1">金額</label>
              <input 
                type="number" 
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="$"
                className="w-full bg-[#F9F7F2] border-2 border-[#E0D8C0] rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-[#F4A261] text-[#5D4632] font-mono font-bold"
              />
            </div>
          </div>

          <button 
            onClick={handleAddBill}
            className="w-full bg-[#F4A261] text-white py-3.5 rounded-full font-bold shadow-md hover:bg-[#E76F51] active:scale-95 transition-all flex justify-center items-center gap-2 mt-2"
          >
            記帳
          </button>
        </div>
      </div>

      <div className="bg-[#FFFEF5] rounded-3xl shadow-sm border border-[#E0D8C0] overflow-hidden">
        <div className="bg-[#F4A261]/20 px-5 py-4 border-b border-[#E0D8C0]">
          <h4 className="font-bold text-[#5D4632] flex items-center gap-2">
            <ArrowRightLeft size={18} className="text-[#E76F51]" />
            消費明細 ({bills.length})
          </h4>
        </div>
        <div className="divide-y divide-[#E0D8C0]">
          {bills.map(bill => {
            const payer = members.find(m => m.id === bill.payerId);
            return (
              <div key={bill.id} className="p-4 flex items-center justify-between group hover:bg-[#F9F7F2] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#F2CC8F] text-2xl flex items-center justify-center border-2 border-white shadow-sm flex-shrink-0">
                    {payer?.avatar || '?'}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-[#5D4632] truncate">{bill.item}</div>
                    <div className="text-xs text-[#8C7B65] flex flex-wrap items-center gap-2">
                      <span>{bill.date}</span>
                      <span className="bg-[#E0D8C0]/30 px-2 py-0.5 rounded-full whitespace-nowrap">
                        {payer?.name || '未知成員'} 先墊
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right">
                    <div className="font-bold text-[#E76F51] font-mono text-lg">${bill.amount}</div>
                  </div>
                  <button 
                    onClick={() => handleDeleteBill(bill.id)}
                    className="p-3 text-[#E0D8C0] hover:text-[#E76F51] rounded-full active:bg-[#E0D8C0]/20 transition-all"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default BillSection;