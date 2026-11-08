"use client";
import { useEffect, useState, useRef } from "react";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase, ref, onValue, set } from "firebase/database";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// ================= KONFIGURASI FIREBASE =================
const firebaseConfig = {
  databaseURL: "https://penetas-telur-8156f-default-rtdb.asia-southeast1.firebasedatabase.app"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getDatabase(app);

export default function Dashboard() {
  // --- STATE MANAGEMENT ---
  const [data, setData] = useState({
    suhu: 0,
    kelembapan: 0,
    hari: 1,
    putaran: 0,
    status_lampu: 0,
    status_motor: 0,
    jenis_unggas: "ayam",
    suhu_min: 37.0,
    suhu_max: 38.0,
  });

  const [inputSuhu, setInputSuhu] = useState({ min: 37, max: 38 });
  const [logs, setLogs] = useState([]);
  const [isClient, setIsClient] = useState(false);
  
  // Status Koneksi (Heartbeat)
  const [isConnected, setIsConnected] = useState(false);
  const lastSyncRef = useRef(Date.now());

  // --- USE EFFECT (LISTEN DATA & HEARTBEAT) ---
  useEffect(() => {
    setIsClient(true);
    const inkubatorRef = ref(db, "inkubator");
    
    // Listener Data Firebase
    onValue(inkubatorRef, (snapshot) => {
      const val = snapshot.val();
      if (val) {
        lastSyncRef.current = Date.now();
        setIsConnected(true);

        const pengaturan = val.pengaturan || {};
        
        setData({
          suhu: val.suhu || 0,
          kelembapan: val.kelembapan || 0,
          hari: val.hari || 1,
          putaran: val.putaran || 0,
          status_lampu: val.status_lampu || 0,
          status_motor: val.status_motor || 0,
          jenis_unggas: pengaturan.jenis_unggas || "ayam",
          suhu_min: pengaturan.suhu_min || 37.0,
          suhu_max: pengaturan.suhu_max || 38.0,
        });

        // Set input form suhu jika belum pernah diubah
        setInputSuhu((prev) => ({
          min: prev.min === 37 ? (pengaturan.suhu_min || 37) : prev.min,
          max: prev.max === 38 ? (pengaturan.suhu_max || 38) : prev.max,
        }));

        if (val.log) {
          const logArray = Object.values(val.log);
          setLogs(logArray);
        }
      }
    });

    // Pengecekan Koneksi setiap 5 detik
    const connectionChecker = setInterval(() => {
      if (Date.now() - lastSyncRef.current > 20000) {
        setIsConnected(false); // Dianggap offline jika > 20 detik tidak ada data
      }
    }, 5000);

    return () => clearInterval(connectionChecker);
  }, []);

  // --- FUNGSI KENDALI & PENGATURAN ---
  const handleResetSiklus = () => {
    const konfirmasi = confirm("Yakin ingin mengulang siklus? Hari akan kembali ke 1 dan putaran ke 0.");
    if (konfirmasi) {
      set(ref(db, "inkubator/hari"), 1);
      set(ref(db, "inkubator/putaran"), 0);
      set(ref(db, "inkubator/kendali_manual/reset_hari"), 1); // Perintah ke NodeMCU
      alert("Siklus berhasil direset!");
    }
  };

  const handleUbahHari = (tambah) => {
    const hariBaru = tambah ? data.hari + 1 : (data.hari > 1 ? data.hari - 1 : 1);
    set(ref(db, "inkubator/hari"), hariBaru);
  };

  const handleUbahUnggas = (e) => {
    const jenisBaru = e.target.value;
    const konfirmasi = confirm(`Ganti ke telur ${jenisBaru.toUpperCase()}? Ini akan mereset hitungan hari dan putaran ke awal.`);
    if (konfirmasi) {
      set(ref(db, "inkubator/pengaturan/jenis_unggas"), jenisBaru);
      set(ref(db, "inkubator/hari"), 1);
      set(ref(db, "inkubator/putaran"), 0);
    }
  };

  const handleSimpanSuhu = () => {
    if (parseFloat(inputSuhu.min) >= parseFloat(inputSuhu.max)) {
      alert("Suhu Minimal tidak boleh lebih besar atau sama dengan Suhu Maksimal!");
      return;
    }
    set(ref(db, "inkubator/pengaturan/suhu_min"), parseFloat(inputSuhu.min));
    set(ref(db, "inkubator/pengaturan/suhu_max"), parseFloat(inputSuhu.max));
    alert("Pengaturan termostat berhasil disimpan ke alat!");
  };

  // --- FUNGSI EXPORT CSV YANG SUDAH DIRAPIKAN ---
  const unduhLaporanCSV = () => {
    if (logs.length === 0) {
      alert("Belum ada data laporan yang tersimpan.");
      return;
    }
    
    let csvContent = "Waktu Pencatatan;Hari Ke-;Suhu Udara (C);Kelembapan (%);Total Putaran\n";
    
    logs.forEach((logString) => {
      try {
        let parts = logString.split("|");
        let waktuMentah = parts[0].trim(); 
        
        let waktu = waktuMentah.substring(waktuMentah.indexOf('[') + 1, waktuMentah.indexOf(']')); 
        let hari = waktuMentah.split("Hari:")[1].trim(); 
        
        let suhu = parts[1].replace("S:", "").replace("C", "").trim(); 
        let rh = parts[2].replace("RH:", "").replace("%", "").trim(); 
        let putar = parts[3].replace("Putar Ke-", "").trim(); 
        
        csvContent += `${waktu};${hari};${suhu};${rh};${putar}\n`;
      } catch (error) {
        // Jika ada baris error, abaikan
      }
    });
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Laporan_Inkubator_${data.jenis_unggas}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- PARSING DATA UNTUK GRAFIK & TABEL UI ---
  const parsedChartData = logs.map((logString) => {
    try {
      let parts = logString.split("|");
      let waktuMentah = parts[0].trim();
      
      let waktu = waktuMentah.substring(waktuMentah.indexOf('[') + 1, waktuMentah.indexOf(']')); 
      let hari = waktuMentah.split("Hari:")[1].trim(); 
      
      let suhu = parseFloat(parts[1].replace("S:", "").replace("C", "").trim()); 
      let kelembapan = parseFloat(parts[2].replace("RH:", "").replace("%", "").trim()); 
      let putaran = parts[3].replace("Putar Ke-", "").trim(); 
      
      // Filter data 'nan' atau 0.0 (jika sensor sempat error saat merekam)
      if (isNaN(suhu) || isNaN(kelembapan) || suhu === 0) return null;
      
      return { waktu, hari, suhu, kelembapan, putaran };
    } catch (error) {
      return null;
    }
  }).filter(item => item !== null);

  if (!isClient) return null;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 text-gray-800 font-sans pb-20">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* HEADER & STATUS KONEKSI */}
        <div className="flex justify-center mb-8">
          {isConnected ? (
            <span className="bg-green-100 text-green-700 font-bold px-6 py-2 rounded-full shadow-sm text-sm tracking-widest animate-pulse">
              🟢 LIVE CONNECTED
            </span>
          ) : (
            <span className="bg-red-100 text-red-700 font-bold px-6 py-2 rounded-full shadow-sm text-sm tracking-widest">
              🔴 OFFLINE / DISCONNECTED
            </span>
          )}
        </div>

        {/* KARTU MONITORING UTAMA */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-2xl shadow-sm text-center border border-gray-100">
            <div className="text-3xl font-black text-red-500 mb-1">{data.suhu.toFixed(1)}<span className="text-lg">°C</span></div>
            <div className="text-xs font-bold text-gray-400 tracking-wider">SUHU UDARA</div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm text-center border border-gray-100">
            <div className="text-3xl font-black text-blue-500 mb-1">{data.kelembapan.toFixed(1)}<span className="text-lg">%</span></div>
            <div className="text-xs font-bold text-gray-400 tracking-wider">KELEMBAPAN</div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm text-center border border-gray-100 relative group">
            <div className="text-3xl font-black text-green-500 mb-1">{data.hari}</div>
            <div className="text-xs font-bold text-gray-400 tracking-wider">HARI INKUBASI</div>
            <div className="absolute inset-x-0 bottom-1 flex justify-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
               <button onClick={() => handleUbahHari(false)} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-2 rounded font-bold">-</button>
               <button onClick={() => handleUbahHari(true)} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-2 rounded font-bold">+</button>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm text-center border border-gray-100">
            <div className="text-3xl font-black text-yellow-500 mb-1">{data.putaran}x</div>
            <div className="text-xs font-bold text-gray-400 tracking-wider">TOTAL PUTARAN</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* PROFIL UNGGAS */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-sm font-bold text-gray-500 mb-4 flex items-center">
              <span className="mr-2">🥚</span> PROFIL & SIKLUS
            </h2>
            <select 
              value={data.jenis_unggas} 
              onChange={handleUbahUnggas}
              className="w-full p-3 mb-4 border border-gray-200 rounded-xl bg-gray-50 font-medium focus:ring-2 focus:ring-blue-400 outline-none"
            >
              <option value="ayam">Telur Ayam (21 Hari)</option>
              <option value="bebek">Telur Bebek/Itik (28 Hari)</option>
              <option value="entok">Telur Entok (35 Hari)</option>
              <option value="angsa">Telur Angsa (30 Hari)</option>
            </select>
            <button 
              onClick={handleResetSiklus}
              className="w-full px-4 py-3 rounded-xl font-bold text-sm text-white bg-red-500 hover:bg-red-600 transition-all shadow-md"
            >
              RESET SIKLUS (MULAI HARI 1)
            </button>
          </div>

          {/* PENGATURAN SUHU TERMOSTAT */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-sm font-bold text-gray-500 mb-4 flex items-center">
              <span className="mr-2">🌡️</span> PENGATURAN TERMOSTAT
            </h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Suhu Min (Nyala)</label>
                <input 
                  type="number" step="0.1" value={inputSuhu.min}
                  onChange={(e) => setInputSuhu({...inputSuhu, min: e.target.value})}
                  className="w-full p-2 border border-gray-200 rounded-lg bg-gray-50 text-center font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Suhu Max (Mati)</label>
                <input 
                  type="number" step="0.1" value={inputSuhu.max}
                  onChange={(e) => setInputSuhu({...inputSuhu, max: e.target.value})}
                  className="w-full p-2 border border-gray-200 rounded-lg bg-gray-50 text-center font-bold"
                />
              </div>
            </div>
            <button 
              onClick={handleSimpanSuhu}
              className="w-full px-4 py-3 rounded-xl font-bold text-sm text-white bg-blue-500 hover:bg-blue-600 transition-all shadow-md"
            >
              SIMPAN PENGATURAN SUHU
            </button>
          </div>
        </div>

        {/* KENDALI AKTUATOR */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <div className="flex space-x-6">
            <div className="flex items-center space-x-3">
              <div className="text-sm font-bold text-gray-500">LAMPU PEMANAS:</div>
              {data.status_lampu === 1 ? (
                <span className="bg-red-500 text-white px-3 py-1 rounded-full font-bold text-xs">ON</span>
              ) : (
                <span className="bg-gray-300 text-gray-600 px-3 py-1 rounded-full font-bold text-xs">OFF</span>
              )}
            </div>
            <div className="flex items-center space-x-3">
              <div className="text-sm font-bold text-gray-500">MOTOR RAK:</div>
              {data.status_motor === 1 ? (
                <span className="bg-blue-500 text-white px-3 py-1 rounded-full font-bold text-xs">BERPUTAR</span>
              ) : (
                <span className="bg-gray-300 text-gray-600 px-3 py-1 rounded-full font-bold text-xs">DIAM</span>
              )}
            </div>
          </div>
        </div>

        {/* GRAFIK DATA TERPISAH */}
        <div className="grid grid-cols-1 gap-6">
          {/* GRAFIK SUHU */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-sm font-bold text-gray-500 mb-6 flex items-center">
              <span className="mr-2">📈</span> GRAFIK SUHU UDARA (°C) - RIWAYAT PENUH
            </h2>
            {parsedChartData.length > 0 ? (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={parsedChartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="waktu" textAnchor="end" tick={{fontSize: 10}} minTickGap={30} />
                    <YAxis domain={['dataMin - 1', 'dataMax + 1']} tick={{fontSize: 12}} />
                    <Tooltip />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="suhu" 
                      name="Suhu (°C)" 
                      stroke="#ef4444" 
                      strokeWidth={2} 
                      dot={parsedChartData.length > 20 ? false : { r: 3 }} 
                      activeDot={{ r: 6 }} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center text-gray-400 py-10 text-sm font-medium">
                Belum ada data grafik suhu yang terekam.
              </div>
            )}
          </div>

          {/* GRAFIK KELEMBAPAN */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-sm font-bold text-gray-500 mb-6 flex items-center">
              <span className="mr-2">💧</span> GRAFIK KELEMBAPAN (%) - RIWAYAT PENUH
            </h2>
            {parsedChartData.length > 0 ? (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={parsedChartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="waktu" textAnchor="end" tick={{fontSize: 10}} minTickGap={30} />
                    <YAxis domain={['dataMin - 5', 'dataMax + 5']} tick={{fontSize: 12}} />
                    <Tooltip />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="kelembapan" 
                      name="Kelembapan (%)" 
                      stroke="#3b82f6" 
                      strokeWidth={2} 
                      dot={parsedChartData.length > 20 ? false : { r: 3 }} 
                      activeDot={{ r: 6 }} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center text-gray-400 py-10 text-sm font-medium">
                Belum ada data grafik kelembapan yang terekam.
              </div>
            )}
          </div>
        </div>

        {/* TABEL RIWAYAT LOG */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-bold text-gray-500 flex items-center">
              <span className="mr-2">📋</span> LAPORAN HARIAN (LOGS)
            </h2>
            <button 
              onClick={unduhLaporanCSV}
              className="px-4 py-2 rounded-lg font-bold text-xs text-white bg-green-600 hover:bg-green-700 shadow-sm transition-all"
            >
              UNDUH EXCEL (CSV)
            </button>
          </div>
          
          <div className="overflow-x-auto max-h-80 overflow-y-auto border border-gray-100 rounded-xl">
            <table className="w-full text-sm text-left text-gray-500">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0 shadow-sm z-10">
                <tr>
                  <th scope="col" className="px-6 py-3">Waktu</th>
                  <th scope="col" className="px-6 py-3">Hari Ke-</th>
                  <th scope="col" className="px-6 py-3">Suhu</th>
                  <th scope="col" className="px-6 py-3">Kelembapan</th>
                  <th scope="col" className="px-6 py-3">Putaran</th>
                </tr>
              </thead>
              <tbody>
                {parsedChartData.length > 0 ? (
                  parsedChartData.slice().reverse().map((log, index) => (
                    <tr key={index} className="bg-white border-b hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">{log.waktu}</td>
                      <td className="px-6 py-4">{log.hari}</td>
                      <td className="px-6 py-4 text-red-500 font-bold">{log.suhu}°C</td>
                      <td className="px-6 py-4 text-blue-500 font-bold">{log.kelembapan}%</td>
                      <td className="px-6 py-4">{log.putaran}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center text-gray-400 font-medium">
                      Data laporan masih kosong.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}