"use client";

import { useEffect, useState } from "react";
import { ref, onValue, set, query, limitToLast } from "firebase/database";
import { database } from "../lib/firebase";

// Komponen Indikator Bulat Presisi dengan Tema Bersih
const CircularGauge = ({ value, min, max, label, color, bgColor, unit }) => {
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const percent = Math.min(Math.max((value - min) / (max - min), 0), 1);
  const offset = circumference - percent * circumference;

  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center">
      <div className="relative w-24 h-24 flex items-center justify-center mb-3">
        <svg className="w-full h-full transform -rotate-90">
          <circle cx="48" cy="48" r={radius} stroke="#f1f5f9" strokeWidth="8" fill="transparent" />
          <circle cx="48" cy="48" r={radius} stroke={color} strokeWidth="8" fill="transparent" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-700 ease-out" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black text-slate-800">{value}</span>
          <span className="text-[10px] font-bold text-slate-400 uppercase">{unit}</span>
        </div>
      </div>
      <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">{label}</p>
      <span className="mt-2 text-[10px] font-bold bg-slate-50 text-slate-400 border border-slate-100 px-2 py-1 rounded-md">Real-time</span>
    </div>
  );
};

export default function DashboardPintar() {
  const [dataTetas, setDataTetas] = useState({
    suhu: 0, kelembapan: 0, hari: 0, putaran: 0, status_lampu: 0, status_motor: 0,
  });
  const [jenisUnggas, setJenisUnggas] = useState("ayam");
  const [logs, setLogs] = useState([]);

  // Referensi Target Berdasarkan Unggas
  const infoUnggas = {
    ayam: { nama: "Telur Ayam", hari: 21, stopPutar: 18 },
    bebek: { nama: "Telur Bebek", hari: 28, stopPutar: 25 },
    entok: { nama: "Telur Entok", hari: 35, stopPutar: 32 },
    angsa: { nama: "Telur Angsa", hari: 30, stopPutar: 27 },
  };

  useEffect(() => {
    // Tarik Data Real-time & Jenis Unggas
    const unsubData = onValue(ref(database, "inkubator"), (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setDataTetas({
          suhu: data.suhu || 0, kelembapan: data.kelembapan || 0,
          hari: data.hari || 0, putaran: data.putaran || 0,
          status_lampu: data.status_lampu || 0, status_motor: data.status_motor || 0,
        });
        if (data.pengaturan && data.pengaturan.jenis_unggas) {
          setJenisUnggas(data.pengaturan.jenis_unggas);
        }
      }
    });

    // Tarik Riwayat Laporan Harian
    const unsubLog = onValue(query(ref(database, "inkubator/log"), limitToLast(60)), (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const parsedLogs = Object.keys(data).map((key) => {
          const raw = data[key];
          const match = raw.match(/\[(.*?)\] Hari:(\d+) \| S:(.*?)C \| RH:(.*?)% \| Putar Ke-(\d+)/);
          return match ? { id: key, waktu: match[1], hari: match[2], suhu: match[3], kelembapan: match[4], putaran: match[5] } : null;
        }).filter(Boolean).reverse();
        setLogs(parsedLogs);
      } else {
        setLogs([]);
      }
    });

    return () => { unsubData(); unsubLog(); };
  }, []);

  // Handler Ubah Jenis Telur
  const handleUbahJenis = (e) => {
    const pilihan = e.target.value;
    setJenisUnggas(pilihan);
    set(ref(database, 'inkubator/pengaturan/jenis_unggas'), pilihan);
  };

  const handlePutarManual = () => {
    set(ref(database, 'inkubator/kendali_manual/motor'), 1);
    alert("Sinyal putar manual dikirim ke mesin tetas!");
    setTimeout(() => set(ref(database, 'inkubator/kendali_manual/motor'), 0), 6000);
  };

  // Ekspor CSV Laporan Harian
  const exportToCSV = () => {
    if (logs.length === 0) return alert("Belum ada data riwayat laporan harian!");
    
    let csvContent = "\uFEFFWaktu Pencatatan,Hari Inkubasi,Suhu Udara (C),Kelembapan (%),Total Putaran\n";
    logs.forEach(log => { csvContent += `"${log.waktu}","Hari Ke-${log.hari}","${log.suhu}","${log.kelembapan}","${log.putaran}"\n`; });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `Laporan_Harian_Inkubator_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-800">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* HEADER */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">Smart Incubator Dashboard</h1>
            <p className="text-slate-500 font-medium text-sm mt-1">Sistem Pemantauan Suhu & Kendali Otomatis Berbasis IoT</p>
          </div>
          <div className="flex items-center gap-3 bg-emerald-50 px-4 py-2 rounded-full border border-emerald-100">
            <span className="h-3 w-3 bg-emerald-500 rounded-full animate-ping"></span>
            <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Live Connected</span>
          </div>
        </div>

        {/* BAGIAN ATAS: INDIKATOR DAN KONTROL */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Panel Kiri: 4 Metrik Utama (Desain Seragam) */}
          <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-4">
            
            <CircularGauge value={dataTetas.suhu} min={20} max={50} label="Suhu Udara" color="#ef4444" unit="°C" />
            <CircularGauge value={dataTetas.kelembapan} min={0} max={100} label="Kelembapan" color="#3b82f6" unit="%" />
            
            {/* Kotak Hari Inkubasi (Diseragamkan) */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center">
              <div className="flex items-center justify-center w-24 h-24 rounded-full bg-emerald-50 border-4 border-emerald-100 mb-3">
                <span className="text-4xl font-black text-emerald-600">{dataTetas.hari}</span>
              </div>
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Hari Inkubasi</p>
              <span className="mt-2 text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 px-2 py-1 rounded-md">Target: {infoUnggas[jenisUnggas].hari} Hari</span>
            </div>
            
            {/* Kotak Putaran (Diseragamkan) */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center">
              <div className="flex items-center justify-center w-24 h-24 rounded-full bg-amber-50 border-4 border-amber-100 mb-3">
                <span className="text-4xl font-black text-amber-500">{dataTetas.putaran}x</span>
              </div>
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Total Putaran</p>
              <span className="mt-2 text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-200 px-2 py-1 rounded-md">Stop H-{infoUnggas[jenisUnggas].stopPutar}</span>
            </div>

          </div>

          {/* Panel Kanan: Setting Jenis & Kendali */}
          <div className="space-y-4">
            
            {/* Profil Inkubator */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="font-bold uppercase tracking-wider text-slate-500 text-xs mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                Profil Inkubator
              </h3>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-slate-700">Pilih Jenis Telur:</label>
                <select 
                  value={jenisUnggas} 
                  onChange={handleUbahJenis}
                  className="bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2.5 font-semibold transition-colors"
                >
                  <option value="ayam">Telur Ayam (21 Hari)</option>
                  <option value="bebek">Telur Bebek Peking (28 Hari)</option>
                  <option value="entok">Telur Entok (35 Hari)</option>
                  <option value="angsa">Telur Angsa/Soang (30 Hari)</option>
                </select>
              </div>
            </div>

            {/* Kendali Aktuator (Desain Putih Konsisten) */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
              <h3 className="font-bold uppercase tracking-wider text-slate-500 text-xs mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                Kendali Aktuator Mesin
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center bg-slate-50 border border-slate-100 p-3 rounded-xl">
                  <div>
                    <p className="text-sm font-bold text-slate-800">Lampu Pemanas</p>
                    <p className="text-[10px] font-medium text-slate-500">Otomatis Terpusat</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-black ${dataTetas.status_lampu === 1 ? 'bg-rose-500 text-white shadow-md shadow-rose-200' : 'bg-slate-200 text-slate-500'}`}>
                    {dataTetas.status_lampu === 1 ? 'ON' : 'OFF'}
                  </span>
                </div>
                
                <div className="flex justify-between items-center bg-slate-50 border border-slate-100 p-3 rounded-xl">
                  <div>
                    <p className="text-sm font-bold text-slate-800">Motor Rak Geser</p>
                    <p className="text-[10px] font-medium text-slate-500">Pembalik Telur</p>
                  </div>
                  <button 
                    onClick={handlePutarManual}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-indigo-200"
                  >
                    PUTAR MANUAL
                  </button>
                </div>
              </div>
            </div>
            
          </div>
        </div>

        {/* BAGIAN BAWAH: TABEL LAPORAN HARIAN */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 px-6 py-5 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div>
              <h3 className="font-bold text-slate-800 uppercase tracking-wide text-sm flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                Laporan Harian (Otomatis)
              </h3>
              <p className="text-xs text-slate-500 mt-1">Jadwal pencatatan sensor: <b>07:00 Pagi</b> | <b>13:00 Siang</b> | <b>19:00 Malam</b></p>
            </div>
            <button 
              onClick={exportToCSV}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-200 transition-all text-xs flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
              Export CSV / Excel
            </button>
          </div>
          
          <div className="overflow-x-auto max-h-72">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-white sticky top-0 shadow-sm border-b border-slate-100">
                <tr className="text-slate-500 text-xs uppercase tracking-wider">
                  <th className="py-4 px-6 font-semibold">Waktu Pencatatan</th>
                  <th className="py-4 px-6 font-semibold">Hari Inkubasi</th>
                  <th className="py-4 px-6 font-semibold">Suhu Udara</th>
                  <th className="py-4 px-6 font-semibold">Kelembapan</th>
                  <th className="py-4 px-6 font-semibold">Total Putaran</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {logs.length > 0 ? (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-6 font-bold text-slate-800">Jam {log.waktu}</td>
                      <td className="py-3 px-6">Hari Ke-{log.hari}</td>
                      <td className="py-3 px-6 font-bold text-rose-500">{log.suhu} °C</td>
                      <td className="py-3 px-6 font-bold text-sky-500">{log.kelembapan} %</td>
                      <td className="py-3 px-6"><span className="px-2.5 py-1 bg-slate-100 text-slate-600 border border-slate-200 rounded-lg font-bold text-xs">Ke-{log.putaran}</span></td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="py-10 text-center text-slate-400 italic">
                      Belum ada laporan harian. Data akan otomatis masuk pada pukul 07:00, 13:00, dan 19:00.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </main>
  );
}
