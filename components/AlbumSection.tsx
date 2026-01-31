import React from 'react';
import { Image as ImageIcon, ExternalLink, Settings } from 'lucide-react';
import { TripInfo } from '../types';

interface AlbumSectionProps {
    tripInfo: TripInfo;
    setTripInfo: React.Dispatch<React.SetStateAction<TripInfo>>;
}

const AlbumSection: React.FC<AlbumSectionProps> = ({ tripInfo }) => {
    // Editing logic removed as per request. Configuration is now centralized in SettingsModal.

    const handleOpenAlbum = () => {
        if (tripInfo.albumUrl) {
            window.open(tripInfo.albumUrl, '_blank');
        }
    };

    return (
        <div className="animate-fade-in pb-20 space-y-6">
            
            {/* Header */}
            <div className="bg-[#FFFEF5] p-5 rounded-3xl shadow-sm border border-[#E0D8C0]">
                <div className="flex justify-between items-start mb-2">
                    <div>
                        <h3 className="font-bold text-[#5D4632] flex items-center gap-2 text-lg">
                            <ImageIcon size={20} className="text-[#F4A261]" />
                            家族回憶相本
                        </h3>
                        <p className="text-xs text-[#8C7B65] mt-1">
                            點擊下方按鈕前往 Google Photos 共用相簿，<br/>
                            上傳您拍的美照與大家分享！
                        </p>
                    </div>
                </div>
            </div>

            {/* Album Card */}
            <div className="bg-[#E9F5D8] border border-[#7BC64F] rounded-3xl p-6 shadow-md text-center">
                {tripInfo.albumUrl ? (
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center border-4 border-[#7BC64F] shadow-sm mb-2 relative">
                             <img 
                                src="https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Google_2015_logo.svg/1200px-Google_2015_logo.svg.png" 
                                alt="Google" 
                                className="w-14 opacity-80"
                                onError={(e) => { e.currentTarget.src = ''; e.currentTarget.style.display='none'; }} 
                             />
                             <ImageIcon size={40} className="text-[#7BC64F] absolute" />
                        </div>
                        
                        <h2 className="text-xl font-bold text-[#5D4632]">
                            {tripInfo.title}
                        </h2>
                        
                        <button 
                            onClick={handleOpenAlbum}
                            className="w-full bg-[#4285F4] text-white py-4 rounded-2xl font-bold text-lg shadow-md hover:bg-[#3367D6] active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            <ExternalLink size={20} />
                            前往雲端相簿
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-4 py-6">
                        <div className="w-20 h-20 bg-white/50 rounded-full flex items-center justify-center border-2 border-dashed border-[#8C7B65] mb-2 text-[#8C7B65]">
                            <ImageIcon size={32} />
                        </div>

                        <h2 className="text-lg font-bold text-[#5D4632] opacity-70">
                            尚未設定相簿連結
                        </h2>
                        
                        <div className="text-sm text-[#8C7B65] bg-white/60 p-4 rounded-xl">
                            <p className="mb-2">請聯繫<span className="font-bold text-[#E76F51]">島主</span>前往「設定」頁面貼上相簿連結。</p>
                            <div className="flex items-center justify-center gap-1 text-xs opacity-70">
                                <Settings size={12} /> 設定 &gt; 活動 &gt; 相簿連結
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AlbumSection;