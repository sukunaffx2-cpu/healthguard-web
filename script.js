import { database, ref, onValue } from "./firebase-config.js";

// ---------------------------------------------------------
// 2. FIREBASE REALTIME DATA (Live Sensors - Dashboard)
// ---------------------------------------------------------
console.log("🚀 Script Connected to Firebase!");

const sensorRef = ref(database, 'sensors');

onValue(sensorRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
        const hr = document.getElementById('heartRate');
        const temp = document.getElementById('temperature');
        const ox = document.getElementById('spo2');
        const bp = document.getElementById('bloodPressure'); 
        const bpStat = document.getElementById('bpStatus');
        const time = document.getElementById('lastUpdateTime');

        if(hr) hr.innerText = data.heartRate || "--";
        if(temp) temp.innerText = data.temperature || "--";
        if(ox) ox.innerText = data.spo2 || "--";
        if(bp) bp.innerText = data.bloodPressure || "120/80"; 

        if(bpStat && data.systolic) {
            if(data.systolic > 140) {
                bpStat.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> <span>High BP</span>';
                bpStat.className = "card-status critical";
            } else {
                bpStat.innerHTML = '<i class="fa-solid fa-heart-pulse"></i> <span>Stable</span>';
                bpStat.className = "card-status normal";
            }
        }
        if(time) time.innerText = new Date().toLocaleTimeString();
    }
});

// ---------------------------------------------------------
// 3. LOAD ACTIVE PATIENT ON DASHBOARD
// ---------------------------------------------------------
window.addEventListener('load', () => {
    const savedPatient = localStorage.getItem('activePatient');
    if (savedPatient && document.getElementById('activeName')) {
        updateCurrentPatientUI(JSON.parse(savedPatient));
    }
});

function updateCurrentPatientUI(p) {
    const activeName = document.getElementById('activeName');
    if (activeName) {
        activeName.innerText = p.name || "No Patient";
        if(document.getElementById('activeAge')) document.getElementById('activeAge').innerText = p.age || "--";
        if(document.getElementById('activeID')) document.getElementById('activeID').innerText = p._id ? p._id.slice(-6).toUpperCase() : "ACTIVE";
        if(document.getElementById('activeCondition')) document.getElementById('activeCondition').innerText = p.disease || p.condition || "Stable";
        if(document.getElementById('activeBlood')) document.getElementById('activeBlood').innerText = p.bloodGroup || "--";
        if(document.getElementById('activeGender')) document.getElementById('activeGender').innerText = p.gender || "--";
    }
}

// ---------------------------------------------------------
// 4. SAVE HEALTH HISTORY & QR/PDF GENERATION
// ---------------------------------------------------------
const saveBtn = document.getElementById('cardSubmitBtn');

if (saveBtn) {
    saveBtn.addEventListener('click', savePatientHistory);
}

async function savePatientHistory() {
    const name = document.getElementById('activeName').innerText;
    if (name === "No Patient" || name === "No Patient Loaded") {
        return alert("❌ Please select a patient first!");
    }

    const healthData = {
        name: name,
        heartRate: document.getElementById('heartRate').innerText,
        temperature: document.getElementById('temperature').innerText,
        spo2: document.getElementById('spo2').innerText,
        bloodPressure: document.getElementById('bloodPressure').innerText,
        timestamp: new Date().toISOString()
    };

    try {
        const res = await fetch('http://127.0.0.1:8080/api/history', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(healthData)
        });
        
        if (res.ok) {
            alert(`✅ ${name} ka data MongoDB mein save ho gaya!`);
            generatePatientQRAndPDF(healthData);
        } else {
            alert("❌ Server issue: Data save nahi hua.");
        }
    } catch (err) {
        console.error("Error saving history:", err);
        alert("❌ Server connect nahi ho raha.");
    }
}

// 🔳 UPDATED: QR Logic for Phone View Digital Card
function generatePatientQRAndPDF(data) {
    const qrDiv = document.getElementById('qrcode');
    if (qrDiv) {
        qrDiv.innerHTML = ""; 

        // Saara data ek object mein (Phone view ke liye)
        const patientDetails = {
            n: data.name,
            a: document.getElementById('activeAge')?.innerText || "--",
            bg: document.getElementById('activeBlood')?.innerText || "--",
            g: document.getElementById('activeGender')?.innerText || "--",
            hr: data.heartRate,
            bp: data.bloodPressure,
            ox: data.spo2,
            tp: data.temperature
        };

        // Encoding for URL
        const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(patientDetails))));
        
        // 🚨 Yahan apni hosting URL daalna (e.g. Vercel link)
        const scanUrl = `https://healthguard-card.vercel.app/view-card.html?report=${encoded}`;

        new QRCode(qrDiv, {
            text: scanUrl, 
            width: 160,
            height: 160,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });
    }

    setTimeout(() => {
        if (confirm("✅ QR Generated! Download Medical Report PDF?")) {
            downloadMedicalPDF(data);
        }
    }, 1000);
}

// 📄 PDF Style Logic
function downloadMedicalPDF(data) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFillColor(13, 17, 23); 
    doc.rect(0, 0, 210, 297, 'F');
    doc.setDrawColor(0, 242, 255); 
    doc.setLineWidth(2);
    doc.rect(5, 5, 200, 287);

    doc.setTextColor(0, 242, 255);
    doc.setFontSize(22);
    doc.text("HEALTHGUARD MEDICAL REPORT", 105, 30, { align: "center" });

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.text(`Patient Name: ${data.name}`, 20, 50);
    doc.text(`Generated On: ${new Date().toLocaleString()}`, 20, 60);

    doc.autoTable({
        startY: 75,
        head: [['Metric', 'Reading', 'Status']],
        body: [
            ['Heart Rate', `${data.heartRate} BPM`, 'Normal'],
            ['Blood Pressure', `${data.bloodPressure} mmHg`, 'Stable'],
            ['Oxygen (SPO2)', `${data.spo2}%`, 'Healthy'],
            ['Body Temp', `${data.temperature}°F`, 'Normal']
        ],
        theme: 'grid',
        headStyles: { fillColor: [0, 242, 255], textColor: [0, 0, 0] },
        bodyStyles: { fillColor: [20, 20, 20], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [30, 30, 30] }
    });

    doc.save(`${data.name}_HealthReport.pdf`);
}

// ---------------------------------------------------------
// 5. PATIENT FORM SAVING & EMERGENCY LOGIC
// ---------------------------------------------------------
const API_URL = 'http://127.0.0.1:8080/api/patients';

const patientForm = document.getElementById('patientForm');
if (patientForm) {
    patientForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = {
            name: document.getElementById('name')?.value || document.getElementById('pName')?.value,
            age: parseInt(document.getElementById('age')?.value || document.getElementById('pAge')?.value),
            disease: document.getElementById('condition')?.value || document.getElementById('pCondition')?.value,
            gender: document.getElementById('gender')?.value || document.getElementById('pGender')?.value,
            bloodGroup: document.getElementById('bloodGroup')?.value || document.getElementById('pBlood')?.value,
            deviceId: document.getElementById('deviceId')?.value || document.getElementById('pDevice')?.value
        };

        try {
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(formData)
            });
            if (res.ok) {
                localStorage.setItem('activePatient', JSON.stringify(formData));
                alert("✅ Patient Saved!");
                window.location.href = "index.html"; 
            }
        } catch (err) { console.error("❌ Error:", err); }
    });
}

const emergencyBtn = document.getElementById('emergencyBtn');
if (emergencyBtn) {
    emergencyBtn.addEventListener('click', function() {
        this.classList.toggle('emergency-active');
        if (this.classList.contains('emergency-active')) {
            document.body.style.boxShadow = "inset 0 0 100px rgba(255, 0, 0, 0.6)";
            this.innerHTML = '<i class="fas fa-bell"></i> STOP ALERT';
        } else {
            document.body.style.boxShadow = "none";
            this.innerHTML = '<i class="fas fa-exclamation-triangle"></i> EMERGENCY';
        }
    });
}

function setActiveSidebarLink() {
    const navLinks = document.querySelectorAll('.sidebar-nav a.nav-item');
    const path = window.location.pathname.split('/').pop() || 'index.html';
    navLinks.forEach(a => {
        if (a.getAttribute('href').split('/').pop() === path) a.classList.add('active');
    });
}
setActiveSidebarLink();