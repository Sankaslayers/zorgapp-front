// Volledig aangepaste App.js met rapportagefunctie, weekoverzicht, type-opslag en live backend ondersteuning
import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import './App.css';

const BASE_URL = "https://zorgappp.onrender.com"; // Live backend URL

export default function App() {
  const [recording, setRecording] = useState(false);
  const [transcriptie, setTranscriptie] = useState("");
  const [originalTranscriptie, setOriginalTranscriptie] = useState("");
  const [translatedFrom, setTranslatedFrom] = useState("");
  const [plan, setPlan] = useState("");
  const [language, setLanguage] = useState("NL");
  const [clientName, setClientName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState("");
  const [search, setSearch] = useState("");
  const [savedData, setSavedData] = useState([]);
  const [view, setView] = useState("dashboard");
  const [weekSamenvattingen, setWeekSamenvattingen] = useState({});

  const mediaRecorderRef = useRef(null);
  const audioChunks = useRef([]);

  useEffect(() => {
    const stored = localStorage.getItem("zorg_data");
    if (stored) setSavedData(JSON.parse(stored));
  }, []);

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start();
    setRecording(true);
    audioChunks.current = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.current.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks.current, { type: "audio/webm" });
      const formData = new FormData();
      formData.append("audio", audioBlob, "opname.webm");

      try {
        const res = await axios.post(`${BASE_URL}/transcribe`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setOriginalTranscriptie(res.data.transcript);
        if (view === "nieuw") {
          const translated = await axios.post(`${BASE_URL}/translate`, {
            text: res.data.transcript,
            language
          });
          setTranscriptie(translated.data.translated);
          setTranslatedFrom(translated.data.translated_from);
          analyseerTranscriptie(translated.data.translated);
        }
      } catch (err) {
        console.error("❌ Fout bij transcriptie:", err);
      }
    };
  };

  const stopRecording = () => {
    mediaRecorderRef.current.stop();
    setRecording(false);
  };

  const analyseerTranscriptie = async (text) => {
    try {
      const response = await axios.post(`${BASE_URL}/analyse`, {
        transcript: text,
        language: language
      });
      setPlan(response.data.analysis);
    } catch (err) {
      console.error("❌ Analysefout:", err);
    }
  };

  const saveToLocal = () => {
    const entryType = view === "rapportage" ? "rapportage" : "intake";
    const newEntry = {
      type: entryType,
      client: clientName,
      birthDate,
      transcriptie,
      originalTranscriptie,
      translatedFrom,
      plan,
      notes,
      tags,
      date: new Date().toLocaleString()
    };
    const updated = [...savedData, newEntry];
    setSavedData(updated);
    localStorage.setItem("zorg_data", JSON.stringify(updated));
  };

  const deleteClient = (index) => {
    const updated = [...savedData];
    updated.splice(index, 1);
    setSavedData(updated);
    localStorage.setItem("zorg_data", JSON.stringify(updated));
  };

  const exportPDFEntry = (entry) => {
    const doc = new jsPDF();
    doc.setFontSize(12);
    let y = 10;
    const addWrappedText = (label, text) => {
      doc.text(label, 10, y);
      y += 6;
      const lines = doc.splitTextToSize(text, 180);
      lines.forEach(line => {
        doc.text(line, 10, y);
        y += 6;
      });
      y += 4;
    };
    addWrappedText(`Type:`, entry.type);
    addWrappedText(`Cliënt:`, entry.client);
    addWrappedText(`Geboortedatum:`, entry.birthDate);
    addWrappedText(`Transcriptie:`, entry.originalTranscriptie);
    addWrappedText(`Analyse:`, entry.plan);
    addWrappedText(`Notities:`, entry.notes);
    addWrappedText(`Tags:`, entry.tags);
    doc.save(`${entry.client}_rapport_${entry.date}.pdf`);
  };

  const genereerWeekSamenvatting = async (client, entries) => {
    const vijfDagenGeleden = new Date();
    vijfDagenGeleden.setDate(vijfDagenGeleden.getDate() - 5);
    const recent = entries.filter(entry => new Date(entry.date) >= vijfDagenGeleden);
    if (recent.length === 0) {
      setWeekSamenvattingen(prev => ({ ...prev, [client]: "Geen rapportages of intakes in de afgelopen 5 dagen." }));
      return;
    }
    const combined = recent.map(entry => {
      const label = entry.type === "intake" ? "[Intake]" : "[Rapportage]";
      return `${label} ${entry.plan || entry.originalTranscriptie}`;
    }).join("\n\n");
    try {
      const response = await axios.post(`${BASE_URL}/analyse`, {
        transcript: combined,
        language: "NL"
      });
      setWeekSamenvattingen(prev => ({ ...prev, [client]: response.data.analysis }));
    } catch (err) {
      console.error("❌ Week samenvatting mislukt:", err);
      setWeekSamenvattingen(prev => ({ ...prev, [client]: "Fout bij samenvatting genereren." }));
    }
  };

  const groupedClients = savedData.reduce((acc, entry) => {
    if (!acc[entry.client]) acc[entry.client] = [];
    acc[entry.client].push(entry);
    return acc;
  }, {});

  const filteredClients = savedData.filter(entry =>
    entry.client.toLowerCase().includes(search.toLowerCase())
  );

if (view === "login") {
  return (
    <div className="login-container" style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      marginTop: '100px'
    }}>
      <img
        src="/logo.png"
        alt="Medisoft Logo"
        style={{ width: "80px", marginBottom: "20px" }}
      />
      <div className="card" style={{
        width: '100%',
        maxWidth: '400px',
        padding: '20px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ textAlign: "center" }}> Medisoft Solutions</h2>
        <label>Gebruikersnaam:</label>
        <input value={username} onChange={(e) => setUsername(e.target.value)} />
        <label>Wachtwoord:</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button onClick={login} style={{ marginTop: "10px", width: "100%" }}>Inloggen</button>
      </div>
    </div>
  );
}


  return (
    <div className="container">
  <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
    <img src="/logo.png" alt="Logo" style={{ height: '80px' }} />
    <h1> Medisoft Solutions</h1>
  </div>
      <nav className="navbar">
        <button onClick={() => setView("dashboard")}>🏠 Dashboard</button>
        <button onClick={() => setView("nieuw")}>➕ Nieuwe intake</button>
        <button onClick={() => setView("rapportage")}>📌 Rapportage</button>
        <button onClick={() => setView("dossier")}>📁 Dossiers</button>
      </nav>

      {view === "nieuw" && (
        <div className="card">
          <h2>🧾 Nieuwe Intake</h2>
          <label>Naam cliënt:</label>
          <input value={clientName} onChange={(e) => setClientName(e.target.value)} />
          <label>Geboortedatum:</label>
          <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
          <label>Taal:</label>
          <select value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="NL">Nederlands</option>
            <option value="EN">Engels</option>
            <option value="TI">Tigrinya</option>
            <option value="AR">Arabisch</option>
          </select>
          {!recording ? <button onClick={startRecording}>🎙️ Start Opname</button> : <button onClick={stopRecording}>⏹️ Stop Opname</button>}
          <h3>Transcriptie (vertaald)</h3>
          <textarea value={transcriptie} readOnly rows={4} />
          <h3>Analyse</h3>
          <textarea value={plan} readOnly rows={8} />
          <h3>Notities</h3>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          <h3>Tags</h3>
          <input value={tags} onChange={(e) => setTags(e.target.value)} />
          <button onClick={saveToLocal}>💾 Opslaan</button>
        </div>
      )}

      {view === "rapportage" && (
        <div className="card">
          <h2>📌 Nieuwe Rapportage</h2>
          <label>Naam cliënt:</label>
          <input value={clientName} onChange={(e) => setClientName(e.target.value)} />
          <label>Geboortedatum:</label>
          <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
          {!recording ? <button onClick={startRecording}>🎙️ Start Opname</button> : <button onClick={stopRecording}>⏹️ Stop Opname</button>}
          <h3>Transcriptie (spraak of typen)</h3>
          <textarea value={originalTranscriptie} onChange={(e) => setOriginalTranscriptie(e.target.value)} rows={5} />
          <h3>Notities</h3>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          <h3>Tags</h3>
          <input value={tags} onChange={(e) => setTags(e.target.value)} />
          <button onClick={saveToLocal}>💾 Opslaan</button>
        </div>
      )}

      {view === "dashboard" && (
        <div className="card">
          <h2>📚 Cliëntenoverzicht</h2>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Zoek op naam..." />
          {filteredClients.length === 0 ? <p>Geen cliënten gevonden.</p> : (
            <ul>
              {filteredClients.map((entry, index) => (
                <li key={index} className="card">
                  <strong>{entry.client}</strong> ({entry.birthDate}) - {entry.date}
                  <button onClick={() => deleteClient(index)} style={{ marginLeft: 10, color: "red" }}>Verwijder</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {view === "dossier" && (
        <div className="card">
          <h2>📁 Cliëntendossiers</h2>
          {Object.entries(groupedClients).map(([client, entries]) => (
            <div key={client} style={{ marginBottom: 20, border: '1px solid #ccc', padding: 10, borderRadius: 8 }}>
              <h3>{client}</h3>
              <details style={{ marginBottom: 10 }}>
                <summary>📅 Weekoverzicht (laatste 5 dagen)</summary>
                <button onClick={() => genereerWeekSamenvatting(client, entries)}>🔄 Genereer Samenvatting</button>
                <pre style={{ whiteSpace: "pre-wrap", marginTop: 10 }}>{weekSamenvattingen[client] || "Nog geen samenvatting opgehaald."}</pre>
              </details>
              <p><strong>Intakes</strong></p>
              {entries.filter(e => e.type === "intake").map((entry, i) => (
                <div key={`intake-${i}`} style={{ paddingLeft: 10, marginBottom: 10 }}>
                  <p><strong>Datum:</strong> {entry.date}</p>
                  <p><strong>Tags:</strong> {entry.tags}</p>
                  <button onClick={() => exportPDFEntry(entry)}>📤 Exporteer rapport</button>
                </div>
              ))}
              <p><strong>Rapportages</strong></p>
              {entries.filter(e => e.type === "rapportage").map((entry, i) => (
                <div key={`rap-${i}`} style={{ paddingLeft: 10, marginBottom: 10 }}>
                  <p><strong>Datum:</strong> {entry.date}</p>
                  <p><strong>Tags:</strong> {entry.tags}</p>
                  <button onClick={() => exportPDFEntry(entry)}>📤 Exporteer rapport</button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}