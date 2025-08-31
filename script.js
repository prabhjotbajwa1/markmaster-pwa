// --- ❗❗❗ IMPORTANT ❗❗❗ ---
// PASTE THE WEB APP URL YOU COPIED FROM GOOGLE APPS SCRIPT DEPLOYMENT HERE
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycby8VTcbZiy5Ok7C28OPIBkLq_yspPGnkxcu_FdQEh5dijTURBjW_U9ETErFCo_FzMkOYQ/exec"; 
// -----------------------------------------

const CLIENT_ID = "777419084569-jf0dd0sd3tkla6iqmbd99tp7o7ttrdip.apps.googleusercontent.com"; // Your Client ID

// --- Global Variables ---
let userAuthToken = null;
let pdfLibrariesLoaded = false;
let allSubjects = [], allSemesters = [], allSessions = [], currentMode = '';
let allTeachers = [], collegeName = '', collegeAddress = '', collegeLogoUrl = '', userEmail = '';
let lastRegisterData = null; 
let lastRegisterCriteria = null; 

// --- Authentication & Initialization ---
window.onload = function () {
  google.accounts.id.initialize({
    client_id: CLIENT_ID,
    callback: handleCredentialResponse
  });

  google.accounts.id.renderButton(
    document.getElementById("google-signin-button"),
    { theme: "outline", size: "large", text: "signin_with" } 
  );

  // This will attempt to sign the user in automatically if they have a session
  google.accounts.id.prompt((notification) => {
    // This part runs if the user is NOT automatically signed in
    if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        // If auto-login doesn't happen, hide loading and show the sign-in button
        document.getElementById('loading-container').style.display = 'none';
        document.getElementById('signin-container').style.display = 'block';
    }
  });
};

function handleCredentialResponse(response) {
  userAuthToken = response.credential;
  // Hide both loading and sign-in containers, show the main app
  document.getElementById('loading-container').style.display = 'none';
  document.getElementById('signin-container').style.display = 'none';
  document.getElementById('app-container').style.display = 'block';
  initializeApp(); 
}

async function initializeApp() {
  try {
    const data = await callAppsScript("getInitialData");
    setupDropdowns(data);
    setupAttendanceDropdowns();
    attachEventListeners();
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("/sw.js")
            .then(reg => console.log("Service Worker registered:", reg.scope))
            .catch(err => console.error("SW registration failed:", err));
    }
  } catch (error) {
    console.error("Initialization failed:", error);
    alert("Error loading initial data: " + error.message);
  }
}

// --- API Communication ---
// --- API Communication ---
async function callAppsScript(functionName, params = []) {
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL === "PASTE_YOUR_WEB_APP_URL_HERE") {
      alert("Error: The Apps Script URL is not set in script.js. Please paste the URL and refresh.");
      throw new Error("Apps Script URL not configured.");
  }
  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: functionName,
        params: params,
        authToken: userAuthToken
      })
    });

    const result = await res.json();
    if (result.status === "error") {
      throw new Error(result.message);
    }
    return result.data;
  } catch(error) {
    const statusMessage = document.getElementById('statusMessage');
    if (statusMessage) {
        statusMessage.textContent = `Error: ${error.message}`;
        statusMessage.className = 'status-message status-error';
        statusMessage.style.display = 'block';
    } else {
        alert(`An error occurred: ${error.message}`);
    }
    throw error;
  }
}

// --- All original frontend functions from this point onwards ---
async function loadPdfLibraries(callback) {
          if (pdfLibrariesLoaded) {
              if (callback) callback();
              return;
          }
          const loadScript = (url, next) => {
              const script = document.createElement('script');
              script.src = url;
              script.onload = next;
              document.head.appendChild(script);
          };
          loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js", () => {
              loadScript("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js", () => {
                  loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js", () => {
                      pdfLibrariesLoaded = true;
                      if (callback) callback();
                   });
              });
          });
}
function attachEventListeners() {
    const navMenu = document.getElementById('nav-menu');
    const navToggle = document.getElementById('nav-toggle');
    const overlay = document.getElementById('overlay');

    const closeMenu = () => {
        navMenu.classList.remove('show');
        overlay.classList.remove('show');
    };

    navToggle.addEventListener('click', () => {
        navMenu.classList.toggle('show');
        overlay.classList.toggle('show');
    });

    overlay.addEventListener('click', closeMenu);

    // This corrected loop reads the new data-section attribute
    document.querySelectorAll('.navbar-buttons button').forEach(button => {
        button.addEventListener('click', () => {
            const sectionId = button.dataset.section;
            if (sectionId) {
                showSection(sectionId);
            }
            closeMenu();
        });
    });

    // --- All your other original event listeners remain below ---
    document.getElementById('sessional1Btn').addEventListener('click', () => setMode('Sessional 1'));
    document.getElementById('sessional2Btn').addEventListener('click', () => setMode('Sessional 2'));
    document.getElementById('continuousBtn').addEventListener('click', () => setMode('Continuous'));
    document.getElementById('semesterSelect').addEventListener('change', () => {
        populateSubjects(document.getElementById('semesterSelect'), document.getElementById('subjectSelect'));
        resetMarksEntryForm();
    });
    document.getElementById('subjectSelect').addEventListener('change', resetMarksEntryForm);
    document.getElementById('batchCountSelect').addEventListener('change', generateBatchInputs);
    ['sessionInput', 'semesterSelect', 'subjectSelect'].forEach(id => document.getElementById(id).addEventListener('change', updateLoadButtonState));
    document.getElementById('loadDataBtn').addEventListener('click', loadMarksData);
    document.getElementById('submitBtn').addEventListener('click', saveData);
    document.getElementById('lockBtn').addEventListener('click', lockData);
    document.getElementById('marksTableContainer').addEventListener('keydown', handleTableInputKeydown);
    document.getElementById('marksTableContainer').addEventListener('paste', handleTablePaste);
    document.getElementById('marksTableContainer').addEventListener('input', handleTableInputValidation);
    document.getElementById('attendanceSemesterSelect').addEventListener('change', () => populateSubjects(document.getElementById('attendanceSemesterSelect'), document.getElementById('attendanceSubjectSelect')));
    document.getElementById('attendanceSubjectSelect').addEventListener('change', toggleBatchSelector);
    ['attendanceSessionSelect', 'attendanceSemesterSelect', 'attendanceSubjectSelect', 'attendanceTeacherSelect'].forEach(id => document.getElementById(id).addEventListener('change', updateAttendanceLoadButton));
    document.getElementById('loadAttendanceBtn').addEventListener('click', loadAttendance);
    document.getElementById('submitAttendanceBtn').addEventListener('click', submitAttendance);
    document.getElementById('backToSelectionBtn').addEventListener('click', showAttendanceSelection);
    document.getElementById('loadAttendanceRegisterBtn').addEventListener('click', handleAttendanceRegisterReport);
    document.getElementById('exportRegisterPdfBtn').addEventListener('click', exportAttendanceRegisterAsPDF);
    document.getElementById('reportSemesterSelect').addEventListener('change', () => populateSubjects(document.getElementById('reportSemesterSelect'), document.getElementById('reportSubjectSelect'), true));
    document.getElementById('reportSubjectSelect').addEventListener('change', toggleReportBatchSelector);
    document.getElementById('generateFoilBtn').addEventListener('click', () => handleReportGeneration('Foil'));
    document.getElementById('generateContinuousBtn').addEventListener('click', () => handleReportGeneration('Continuous'));
    document.getElementById('generateFinalBtn').addEventListener('click', () => handleReportGeneration('Final'));
    document.getElementById('printBtn').addEventListener('click', () => window.print());
    document.getElementById('exportPdfBtn').addEventListener('click', exportFoilReportAsPDF);
    document.getElementById('exportAttendancePdfBtn').addEventListener('click', exportAttendanceReportAsPDF);
    document.getElementById('exportConsolidatedPdfBtn').addEventListener('click', exportConsolidatedReportAsPDF);
    document.getElementById('generateAttendanceReportBtn').addEventListener('click', handleAttendanceReport);
    document.getElementById('generateConsolidatedReportBtn').addEventListener('click', handleConsolidatedReport);
    document.getElementById('generateReportCardBtn').addEventListener('click', handleReportCardGeneration);
    document.getElementById('exportReportCardPdfBtn').addEventListener('click', exportReportCardsAsPDF);
    document.getElementById('reportCardSemesterSelect').addEventListener('change', populateReportCardRollNumbers);
    ['reportCardSessionSelect', 'reportCardSemesterSelect', 'reportCardSessionalSelect', 'reportCardRollNoSelect'].forEach(id => {
        document.getElementById(id).addEventListener('change', () => {
            document.getElementById('generateReportCardBtn').classList.remove('active');
            document.getElementById('reportCardOutput').innerHTML = '';
            document.getElementById('reportCardActionButtons').style.display = 'none';
        });
    });
    document.getElementById('statusSemesterSelect').addEventListener('change', loadStatusDashboard);
    document.getElementById('statusSessionSelect').addEventListener('change', loadStatusDashboard);
}
function setupDropdowns(data) {
          allSubjects = data.subjects;
          allSemesters = data.semesters;
          allSessions = data.sessions;
          allTeachers = data.teachers;
          collegeName = data.institutionName;
          collegeAddress = data.institutionAddress;
          collegeLogoUrl = data.logo;
          userEmail = data.userEmail;
          if (collegeName) {
              document.title = collegeName + " | AcadVista ©";
              document.querySelector('.navbar .title').textContent = `AcadVista ©`;
              document.getElementById('welcomeTitle').textContent = `Welcome to AcadVista at ${collegeName}`;
          }
          const semesterIds = ['semesterSelect', 'reportSemesterSelect', 'statusSemesterSelect', 'reportCardSemesterSelect', 'attendanceSemesterSelect'];
          semesterIds.forEach(id => {
              const sel = document.getElementById(id);
              if (sel) {
                  sel.innerHTML = '<option value="">Select Semester</option>';
                  allSemesters.forEach(sem => sel.add(new Option(sem, sem)));
              }
           });
          const sessionIds = ['sessionInput', 'reportSessionSelect', 'statusSessionSelect', 'reportCardSessionSelect', 'attendanceSessionSelect'];
          sessionIds.forEach(id => {
              const sel = document.getElementById(id);
              if (sel) {
                  sel.innerHTML = '<option value="">Select Session</option>';
                  allSessions.forEach(s => sel.add(new Option(s, s)));
              }
           });
}
function showSection(id) {
    // Deactivate all main content sections
    document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
    // Activate the one that was clicked
    document.getElementById(id).classList.add('active');

    // Deactivate all navigation buttons
    document.querySelectorAll('.navbar-buttons button').forEach(btn => btn.classList.remove('active'));
    // Activate the correct navigation button by looking for the matching data-section
    document.querySelector(`.navbar-buttons button[data-section="${id}"]`).classList.add('active');
}
function onError(error) {
          const statusMessage = document.getElementById('statusMessage');
          statusMessage.textContent = `Error: ${error.message}`;
          statusMessage.className = 'status-message status-error';
          statusMessage.style.display = 'block';
}
function toTitleCase(str) {
          return str ? str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') : '';
}
function numberToWords(num) {
          if (num === '' || isNaN(num) || num === null) return '';
          num = Math.round(Number(num));
          const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
          const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
          if (num === 0) return 'Zero';
          if (num > 99) return num.toString();
          let word = num < 20 ? a[num] : b[Math.floor(num / 10)] + (num % 10 !== 0 ? ' ' + a[num % 10] : '');
          return word ? word + ' only' : '';
}
function populateSubjects(sourceSelect, targetSelect, includeAll = false) {
          const selectedSem = sourceSelect.value;
          targetSelect.innerHTML = '<option value="">Select Subject</option>';
          if (includeAll) targetSelect.add(new Option('All Subjects', 'all'));
          if (selectedSem) {
              const filteredSubjects = allSubjects.filter(s => s.semester === selectedSem);
              filteredSubjects.forEach(s => targetSelect.add(new Option(`${s.code} - ${s.name}`, s.code)));
          }
}
function setupAttendanceDropdowns() {
          const teacherSel = document.getElementById('attendanceTeacherSelect');
          teacherSel.innerHTML = '<option value="">Select Teacher</option>';
          let loggedInTeacherName = null;
          allTeachers.forEach(teacher => {
              teacherSel.add(new Option(teacher.name, teacher.name));
              if (teacher.email.toLowerCase() === userEmail.toLowerCase()) {
                  loggedInTeacherName = teacher.name;
              }
          });
          if (loggedInTeacherName) {
              teacherSel.value = loggedInTeacherName;
          }
          document.getElementById('attendanceDate').innerText = new Date().toLocaleDateString('en-GB');
          updateAttendanceLoadButton();
}
function toggleBatchSelector() {
    const subjectCode = document.getElementById('attendanceSubjectSelect').value;
    const batchSelect = document.getElementById('attendanceBatchSelect');
    const registerBtn = document.getElementById('loadAttendanceRegisterBtn');
    const subject = allSubjects.find(s => s.code === subjectCode);
    if (subject && subject.type === 'Practical') {
        batchSelect.style.display = 'block';
    } else {
        batchSelect.style.display = 'none';
        batchSelect.value = '';
    }
    if (subjectCode) {
        registerBtn.style.display = 'inline-flex';
    } else {
        registerBtn.style.display = 'none';
    }
    updateAttendanceLoadButton();
}
function updateAttendanceLoadButton() {
          const btn = document.getElementById('loadAttendanceBtn');
          const session = document.getElementById('attendanceSessionSelect').value;
          const semester = document.getElementById('attendanceSemesterSelect').value;
          const subject = document.getElementById('attendanceSubjectSelect').value;
          const teacher = document.getElementById('attendanceTeacherSelect').value;
          btn.disabled = !(session && semester && subject && teacher);
}
async function loadAttendance() {
          const loadBtn = document.getElementById('loadAttendanceBtn');
          loadBtn.disabled = true;
          loadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading...';
          const criteriaForCheck = {
              session: document.getElementById('attendanceSessionSelect').value,
              semester: document.getElementById('attendanceSemesterSelect').value,
              subject: document.getElementById('attendanceSubjectSelect').options[document.getElementById('attendanceSubjectSelect').selectedIndex].text,
              date: new Date().toISOString()
          };
          try {
            const existingLectures = await callAppsScript('checkExistingAttendanceForDay', [criteriaForCheck]);
            if (existingLectures && existingLectures.length > 0) {
                  const highestLecture = Math.max(...existingLectures);
                  const newLectureNum = highestLecture + 1;
                  const choice = prompt(`Attendance for Lecture(s) ${existingLectures.join(', ')} already exists for today.\n\n- To create a new record for Lecture ${newLectureNum}, enter '${newLectureNum}'.\n- To edit an existing lecture, enter its number (e.g., '1').\n- To cancel, press Cancel.`);
                  if (choice === null || isNaN(parseInt(choice))) {
                      loadBtn.disabled = false;
                      loadBtn.innerHTML = '<i class="fa-solid fa-users"></i> Load Students';
                      return;
                  }
                  document.getElementById('attendanceLectureNo').value = choice;
                  await proceedToLoad();
            } else {
                  document.getElementById('attendanceLectureNo').value = 1;
                  await proceedToLoad();
            }
          } catch(error) {
               loadBtn.disabled = false;
               loadBtn.innerHTML = '<i class="fa-solid fa-users"></i> Load Students';
          }
}
async function proceedToLoad() {
    document.getElementById('attendanceContainer').style.display = 'block';
    const loadBtn = document.getElementById('loadAttendanceBtn');
    const subjectSelect = document.getElementById('attendanceSubjectSelect');
    const lectureNo = document.getElementById('attendanceLectureNo').value;
    const criteria = {
        session: document.getElementById('attendanceSessionSelect').value,
        semester: document.getElementById('attendanceSemesterSelect').value,
        subject: subjectSelect.options[subjectSelect.selectedIndex].text,
        subjectCode: subjectSelect.value,
        batch: document.getElementById('attendanceBatchSelect').value,
        date: new Date().toISOString(),
        lectureNo: lectureNo
    };
    try {
        const savedAttendance = await callAppsScript('getAttendance', [criteria]);
        const students = await callAppsScript('getStudentList', [criteria.session, criteria.semester, criteria.subjectCode, criteria.batch]);
        buildAttendanceList(students, new Map(savedAttendance));
        loadBtn.disabled = false;
        loadBtn.innerHTML = '<i class="fa-solid fa-users"></i> Load Students to Take Attendance';
        document.getElementById('submitAttendanceBtn').style.display = 'inline-flex';
        document.getElementById('backToSelectionBtn').style.display = 'inline-flex';
        document.getElementById('attendanceSelectionCard').style.display = 'none';
    } catch(e) {
        // error is already handled by callAppsScript
    }
}
function showAttendanceSelection() {
    document.getElementById('attendanceSelectionCard').style.display = 'block';
    document.getElementById('attendanceContainer').style.display = 'none';
    document.getElementById('backToSelectionBtn').style.display = 'none';
}
function buildAttendanceList(students, savedAttendance) {
    const container = document.getElementById('attendanceList');
    if (!students || students.length === 0) {
        container.innerHTML = "<p>No students found for this selection.</p>";
        return;
    }
    
    let listHTML = '<div class="attendance-grid">';
    students.forEach(student => {
        const rollNo = student[0].toString();
        const name = student[1];
        const fathersName = student[2];
        const status = savedAttendance.get(rollNo) === 'A' ? 'A' : 'P';
        const rowClass = status === 'P' ? 'present' : 'absent';
        listHTML += `
             <div class="student-row ${rowClass}" 
                 data-rollno="${rollNo}" data-name="${name}" data-fathers-name="${fathersName}"
                 data-status="${status}" onclick="toggleRowAttendance(this)">
                <div class="student-rollno-circle">${rollNo}</div>
                <div class="student-info">
                    <div class="student-name">${name}</div>
                    <div class="student-fathers-name">${fathersName}</div>
                </div>
            </div>`;
    });
    listHTML += '</div>';
    container.innerHTML = listHTML;
    updateAttendanceSummary();
}
function toggleRowAttendance(rowElement) {
          const currentStatus = rowElement.dataset.status;
          const newStatus = currentStatus === 'P' ? 'A' : 'P';
          rowElement.dataset.status = newStatus;
          rowElement.classList.toggle('present');
          rowElement.classList.toggle('absent');
          updateAttendanceSummary();
}
function updateAttendanceSummary() {
          const presentCount = document.querySelectorAll('#attendanceList .student-row.present').length;
          const absentCount = document.querySelectorAll('#attendanceList .student-row.absent').length;
          const summaryDiv = document.getElementById('attendanceSummaryCounters');
          summaryDiv.innerHTML = `
            <span class="summary-present">✅ Present: ${presentCount}</span>
            <span class="summary-absent">❌ Absent: ${absentCount}</span>`;
}
function markAllAttendance(status) {
          const rows = document.querySelectorAll('#attendanceList .student-row');
          const newClass = status === 'P' ? 'present' : 'absent';
          const oldClass = status === 'P' ? 'absent' : 'present';
          rows.forEach(row => {
              row.dataset.status = status;
              row.classList.remove(oldClass);
              row.classList.add(newClass);
          });
          updateAttendanceSummary();
}
async function submitAttendance() {
          const submitBtn = document.getElementById('submitAttendanceBtn');
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
          const attendanceRecords = [];
          document.querySelectorAll('.student-row').forEach(row => {
              if (row.dataset.status) {
                  attendanceRecords.push({
                      rollNo: row.dataset.rollno,
                      name: row.dataset.name,
                      fathersName: row.dataset.fathersName,
                      status: row.dataset.status
                  });
              }
          });
        const lectureNo = document.getElementById('attendanceLectureNo').value;
        const data = {
            session: document.getElementById('attendanceSessionSelect').value,
            semester: document.getElementById('attendanceSemesterSelect').value,
            subject: document.getElementById('attendanceSubjectSelect').options[document.getElementById('attendanceSubjectSelect').selectedIndex].text,
            teacher: document.getElementById('attendanceTeacherSelect').value,
            date: new Date().toISOString(),
            attendanceRecords: attendanceRecords,
            batch: document.getElementById('attendanceBatchSelect').value,
            lectureNo: lectureNo
        };
        try {
            const message = await callAppsScript('saveAttendance', [data]);
            alert(message);
        } catch(e) {
            // error handled by callAppsScript
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-save"></i> Submit Attendance';
        }
}
async function handleAttendanceRegisterReport() {
     document.getElementById('attendanceSummary').style.display = 'none';
     document.getElementById('submitAttendanceBtn').style.display = 'none';
    document.getElementById('registerActionButtons').style.display = 'none';
    const loadBtn = document.getElementById('loadAttendanceRegisterBtn');
    const originalBtnHTML = loadBtn.innerHTML;
    loadBtn.disabled = true;
    loadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating...';

    const container = document.getElementById('attendanceContainer');
    container.style.display = 'block';
    document.getElementById('attendanceList').innerHTML = '<p class="status-message status-loading">Generating Attendance Register...</p>';

    const subjectSelect = document.getElementById('attendanceSubjectSelect');
    const criteria = {
        session: document.getElementById('attendanceSessionSelect').value,
        semester: document.getElementById('attendanceSemesterSelect').value,
        subjectCode: subjectSelect.value,
        batch: document.getElementById('attendanceBatchSelect').value,
        teacher: document.getElementById('attendanceTeacherSelect').value
    };
    lastRegisterCriteria = criteria;
    try {
        const data = await callAppsScript('getAttendanceRegisterData', [criteria]);
        buildAttendanceRegister(data, criteria);
    } catch(e) {
        // error handled
    } finally {
        loadBtn.disabled = false;
        loadBtn.innerHTML = originalBtnHTML;
    }
}
function setMode(mode) {
          currentMode = mode;
          document.querySelectorAll('#marks .action-buttons button').forEach(btn => btn.classList.remove('active'));
          if (mode === 'Sessional 1') document.getElementById('sessional1Btn').classList.add('active');
          else if (mode === 'Sessional 2') document.getElementById('sessional2Btn').classList.add('active');
          else if (mode === 'Continuous') document.getElementById('continuousBtn').classList.add('active');
          document.getElementById('entryDetails').style.display = 'block';
          document.getElementById('entryContainer').style.display = 'none';
          resetMarksEntryForm();
}
function togglePracticalInputs() {
          const subjectCode = document.getElementById('subjectSelect').value;
          const subject = allSubjects.find(s => s.code === subjectCode);
          const isSessional = currentMode.startsWith('Sessional');
          const isPractical = subject && subject.type === 'Practical';
          const teacherDateContainer = document.getElementById('teacherDateContainer');
          const practicalBatchContainer = document.getElementById('practicalBatchContainer');
          const dateInput = document.getElementById('dateInput');
          teacherDateContainer.style.display = 'none';
          practicalBatchContainer.style.display = 'none';
          if (isPractical && (isSessional || currentMode === 'Continuous')) {
              practicalBatchContainer.style.display = 'block';
          } else {
              teacherDateContainer.style.display = 'grid';
              dateInput.style.display = isSessional ? 'block' : 'none';
          }
}
function generateBatchInputs() {
          const count = document.getElementById('batchCountSelect').value;
          const container = document.getElementById('batchDetailsInputs');
          container.innerHTML = '';
          if (!count) return;
          const batchLabels = ['A', 'B', 'C', 'D'];
          let teacherOptions = '<option value="">Select Teacher</option>';
          allTeachers.forEach(teacher => teacherOptions += `<option value="${teacher.name}">${teacher.name}</option>`);
          for (let i = 0; i < count; i++) {
              const label = batchLabels[i];
              const dateInputHtml = currentMode.startsWith('Sessional') ?
                  `<div><label for="dateInput${label}">Date for Batch ${label}</label><input type="date" id="dateInput${label}" data-batch="${label}"></div>` : '';
              container.innerHTML += `
                ${dateInputHtml}
                <div><label for="teacherInput${label}">Teacher for Batch ${label}</label><select id="teacherInput${label}" data-batch="${label}">${teacherOptions}</select></div>`;
          }
}
function updateLoadButtonState() {
          const btn = document.getElementById('loadDataBtn');
          if (btn) {
              const session = document.getElementById('sessionInput').value;
              const semester = document.getElementById('semesterSelect').value;
              const subject = document.getElementById('subjectSelect').value;
              btn.disabled = !(session && semester && subject);
          }
}
function resetMarksEntryForm() {
          document.getElementById('entryContainer').style.display = 'none';
          document.getElementById('teacherInput').value = '';
          document.getElementById('dateInput').value = '';
          document.getElementById('marksTableContainer').innerHTML = '';
          document.getElementById('submitBtn').style.display = 'none';
          document.getElementById('lockBtn').style.display = 'none';
          document.getElementById('batchCountSelect').value = '';
          document.getElementById('batchDetailsInputs').innerHTML = '';
          const statusMessage = document.getElementById('statusMessage');
          statusMessage.textContent = '';
          statusMessage.style.display = 'none';
          togglePracticalInputs();
}
async function loadMarksData() {
          const loadBtn = document.getElementById('loadDataBtn');
          const originalBtnHTML = loadBtn.innerHTML;
          loadBtn.disabled = true;
          loadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading...';
          document.getElementById('entryContainer').style.display = 'block';
          const criteria = getCriteria(false, null, true);
          if (!criteria) {
              document.getElementById('entryContainer').style.display = 'none';
              loadBtn.disabled = false;
              loadBtn.innerHTML = originalBtnHTML;
              return;
          }
          const statusMessage = document.getElementById('statusMessage');
          statusMessage.textContent = 'Loading...';
          statusMessage.className = 'status-message status-loading';
          statusMessage.style.display = 'block';
          const reEnableButton = () => {
              loadBtn.disabled = false;
              loadBtn.innerHTML = originalBtnHTML;
          };
          try {
            const data = await callAppsScript('getSavedMarks', [criteria]);
            await onDataLoaded(data, criteria);
            reEnableButton();
          } catch(e) {
            reEnableButton();
          }
}
async function onDataLoaded(data, criteria) {
          const statusMessage = document.getElementById('statusMessage');
          if (data.lockStatus.isLocked) {
              statusMessage.textContent = `LOCKED on ${data.lockStatus.timestamp} by ${data.lockStatus.lockedBy}.`;
              statusMessage.className = 'status-message status-locked';
              document.getElementById('marksTableContainer').innerHTML = '';
              document.getElementById('submitBtn').style.display = 'none';
              document.getElementById('lockBtn').style.display = 'none';
              return;
          }
          statusMessage.textContent = 'Student list loaded. You can now fill or edit marks.';
          statusMessage.className = 'status-message status-success';
          const subject = allSubjects.find(s => s.code === criteria.subjectCode);
          const teacherSelect = document.getElementById('teacherInput');
          teacherSelect.innerHTML = '<option value="">Select Teacher</option>';
          allTeachers.forEach(teacher => teacherSelect.add(new Option(teacher.name, teacher.name)));
          if (subject.type === 'Practical' && (currentMode.startsWith('Sessional') || currentMode === 'Continuous')) {
              if (data.practicalMetadata && data.practicalMetadata.length > 0) {
                  document.getElementById('batchCountSelect').value = data.practicalMetadata.length;
                  generateBatchInputs();
                  data.practicalMetadata.forEach(meta => {
                      const batchLetter = meta.batch.match(/Batch\s(\w)/)[1];
                      const dateInput = document.getElementById(`dateInput${batchLetter}`);
                      if (dateInput) dateInput.value = meta.date;
                      document.getElementById(`teacherInput${batchLetter}`).value = meta.teacher;
                  });
              } else if (currentMode === 'Continuous') {
                  statusMessage.textContent = 'Please enter Sessional 1 marks and teacher data for this subject first to auto-fill teacher names.';
                  statusMessage.className = 'status-message status-locked';
              }
          } else {
              if (data.metadata.teacher) document.getElementById('teacherInput').value = data.metadata.teacher;
              if (data.metadata.date) document.getElementById('dateInput').value = data.metadata.date;
          }
          try {
            const students = await callAppsScript('getStudentList', [criteria.session, criteria.semester, criteria.subjectCode]);
            buildMarksTable(students, data.savedData, criteria.subjectCode);
          } catch(e) {
            // error handled
          }
}
function buildMarksTable(students, savedData, subjectCode) {
          const container = document.getElementById('marksTableContainer');
          if (!students || students.length === 0) {
              container.innerHTML = "<p>No students found for this semester or elective subject.</p>";
              document.getElementById('submitBtn').style.display = 'none';
              document.getElementById('lockBtn').style.display = 'none';
              return;
          }
          const subject = allSubjects.find(s => s.code === subjectCode);
          let tableHTML = '<table><thead><tr><th>Roll No</th><th>Name</th><th>Father\'s Name</th>';
          if (currentMode.startsWith('Sessional')) {
              tableHTML += `<th>Marks (Max: ${subject.entryMax})</th>`;
          } else {
              tableHTML += subject.type === 'Theory' ? '<th>Attendance (4)</th><th>Academic (3)</th><th>Interaction (3)</th>' : '<th>Attendance (2)</th><th>Academic Activity (3)</th>';
          }
          tableHTML += '</tr></thead><tbody>';
          students.forEach(student => {
              const rollNo = student[0];
              const saved = savedData[rollNo] || {};
              tableHTML += `<tr><td>${rollNo}</td><td>${student[1]}</td><td>${student[2]}</td><td>`;
              if (currentMode.startsWith('Sessional')) {
                  tableHTML += `<input type="number" class="marks-input" value="${saved || ''}" max="${subject.entryMax}">`;
              } else {
                  if (subject.type === 'Theory') {
                      tableHTML += `<input type="number" class="marks-input" data-component="att" value="${saved.att || ''}" max="4"></td><td><input type="number" class="marks-input" data-component="act" value="${saved.act || ''}" max="3"></td><td><input type="number" class="marks-input" data-component="int" value="${saved.int || ''}" max="3">`;
                  } else {
                      tableHTML += `<input type="number" class="marks-input" data-component="att" value="${saved.att || ''}" max="2"></td><td><input type="number" class="marks-input" data-component="act" value="${saved.act ||''}" max="3">`;
                  }
              }
              tableHTML += '</td></tr>';
          });
          tableHTML += '</tbody></table>';
          container.innerHTML = tableHTML;
          document.getElementById('submitBtn').style.display = 'inline-flex';
          document.getElementById('lockBtn').style.display = 'inline-flex';
}
function getCriteria(isReport = false, reportModeOverride = null, isLoadOperation = false) {
          const session = document.getElementById('sessionInput').value;
          const semester = document.getElementById('semesterSelect').value;
          const subjectCode = document.getElementById('subjectSelect').value;
          const mode = reportModeOverride || currentMode;
          if (!session || !semester || !subjectCode) {
              if (!isLoadOperation) onError({
                  message: "Please select Session, Semester, and Subject."
              });
              return null;
          }
          const subject = allSubjects.find(s => s.code === subjectCode);
          const subjectName = subject ? `${subject.code} - ${subject.name}` : '';
          const baseCriteria = {
              session,
              semester,
              subject: subjectName,
              subjectCode,
              mode
          };
          if (isLoadOperation || isReport) return baseCriteria;
          if (subject && subject.type === 'Practical' && (mode.startsWith('Sessional') || mode === 'Continuous')) {
              const batchMetadata = [];
              const count = document.getElementById('batchCountSelect').value;
              if (!count) {
                  onError({ message: "Please select the number of batches." });
                  return null;
              }
              const batchLabels = ['A', 'B', 'C', 'D'];
              for (let i = 0; i < count; i++) {
                  const label = batchLabels[i];
                  const teacher = document.getElementById(`teacherInput${label}`).value;
                  if (!teacher) {
                      onError({ message: `Please fill in teacher name for Batch ${label}.` });
                      return null;
                  }
                  if (mode.startsWith('Sessional')) {
                      const date = document.getElementById(`dateInput${label}`).value;
                      if (!date) {
                          onError({ message: `Please fill in date for Batch ${label}.` });
                          return null;
                      }
                      batchMetadata.push({ batch: `Batch ${label} ${mode}`, date, teacher });
                  } else {
                      batchMetadata.push({ batch: `Batch ${label}`, teacher });
                  }
              }
              if (mode === 'Continuous') return { ...baseCriteria,
                  teacher: batchMetadata[0].teacher
              };
              return { ...baseCriteria,
                  batchMetadata
              };
          } else {
              const teacher = document.getElementById('teacherInput').value;
              if (!teacher) {
                  onError({ message: "Please fill in Teacher's Name." });
                  return null;
              }
              if (mode.startsWith('Sessional')) {
                  const date = document.getElementById('dateInput').value;
                  if (!date) {
                      onError({ message: "Please provide the Date of Exam." });
                      return null;
                  }
                  return { ...baseCriteria, teacher, date };
              }
              return { ...baseCriteria, teacher };
          }
}
async function saveData() {
          if (!validateAllMarks()) return;
          const criteria = getCriteria();
          if (!criteria) return;
          const submitBtn = document.getElementById('submitBtn');
          const originalBtnHTML = submitBtn.innerHTML;
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
          const marks = [];
          document.getElementById('marksTableContainer').querySelectorAll('tbody tr').forEach(row => {
              const [rollNo, name, fathersName] = Array.from(row.cells).slice(0, 3).map(cell => cell.textContent);
              if (currentMode.startsWith('Sessional')) {
                  const mark = row.cells[3].querySelector('input').value;
                  if (mark) marks.push({ rollNo, name, fathersName, mark });
              } else {
                  const inputs = row.querySelectorAll('.marks-input');
                  const [att, act, int] = [inputs[0] ?.value || '', inputs[1] ?.value || '', inputs[2] ?.value || ''];
                  if (att || act || int) marks.push({ rollNo, name, fathersName, att, act, int });
              }
          });
          criteria.marks = marks;
          const reEnableButton = () => {
              submitBtn.disabled = false;
              submitBtn.innerHTML = originalBtnHTML;
          };
          try {
            const message = await callAppsScript('saveData', [criteria]);
            alert(message);
            document.getElementById('statusMessage').style.display = 'none';
            reEnableButton();
          } catch(e) {
            reEnableButton();
          }
}
async function lockData() {
          if (!validateAllMarks()) return;
          if (!confirm("Are you sure? This action is permanent and cannot be undone.")) return;
          const criteria = getCriteria();
          if (!criteria) return;
          try {
            const message = await callAppsScript('lockMarks', [criteria]);
            alert(message);
            document.getElementById('loadDataBtn').click();
          } catch(e) {
            // error handled
          }
}
function handleTableInputKeydown(e) {
          if (e.key === 'Enter' && e.target.classList.contains('marks-input')) {
              e.preventDefault();
              const inputs = Array.from(document.querySelectorAll('#marksTableContainer .marks-input'));
              const currentIndex = inputs.indexOf(e.target);
              const nextInput = inputs[currentIndex + 1];
              if (nextInput) {
                  nextInput.focus();
                  nextInput.select();
              } else {
                  document.getElementById('submitBtn').focus();
              }
          }
}
function handleTablePaste(e) {
          if (!e.target.classList.contains('marks-input')) return;
          e.preventDefault();
          const pasteData = e.clipboardData.getData('text');
          const lines = pasteData.split(/\r?\n/).filter(line => line.trim() !== '');
          const inputs = Array.from(document.querySelectorAll('#marksTableContainer .marks-input'));
          const startIndex = inputs.indexOf(e.target);
          lines.forEach((line, i) => {
              const targetIndex = startIndex + i;
              if (targetIndex < inputs.length) {
                  inputs[targetIndex].value = line.split('\t')[0] || '';
                  validateInput(inputs[targetIndex]);
              }
          });
}
function handleTableInputValidation(e) {
          if (e.target.classList.contains('marks-input')) validateInput(e.target);
}
function validateInput(input) {
          const value = parseFloat(input.value);
          const max = parseFloat(input.getAttribute('max'));
          if (!isNaN(value) && !isNaN(max) && value > max) {
              alert(`Marks entered (${value}) cannot be more than the maximum marks (${max}).`);
              input.value = '';
              input.focus();
              return false;
          }
          return true;
}
function validateAllMarks() {
          return Array.from(document.querySelectorAll('#marksTableContainer .marks-input')).every(validateInput);
}
async function handleReportGeneration(reportType) {
          const session = document.getElementById('reportSessionSelect').value;
          const semester = document.getElementById('reportSemesterSelect').value;
          const subjectCode = document.getElementById('reportSubjectSelect').value;
          if (!session || !semester || !subjectCode) {
              alert("Please select a Session, Semester, and Subject.");
              return;
          }
          let sessional = '1';
          if (reportType === 'Foil') {
              const sessionalChoice = prompt("Generate report for which sessional? (Enter 1 or 2)", "1");
              if (sessionalChoice !== '1' && sessionalChoice !== '2') return;
              sessional = sessionalChoice;
          }
          document.getElementById('reportOutput').innerHTML = `<div class="card"><p class="status-message status-loading">Generating Report(s)...</p></div>`;
          document.getElementById('reportActionButtons').style.display = 'none';
          const criteria = {
              session,
              semester,
              subjectCode,
              reportType,
              sessional
          };
          try {
            const reports = await callAppsScript('getBulkReportData', [criteria]);
            buildBulkReport(reports);
          } catch(e) {
            // error handled
          }
}
function buildBulkReport(reports) {
          const reportOutput = document.getElementById('reportOutput');
          if (!reports || reports.length === 0) {
              reportOutput.innerHTML = "<div class='card'><p>No data found.</p></div>";
              document.getElementById('reportActionButtons').style.display = 'none';
              return;
          }
          let bulkHTML = '';
          const reportType = reports[0].studentData[0].hasOwnProperty('finalAssessment') ? 'Final' : (reports[0].studentData[0].hasOwnProperty('marks') ? 'Foil' : 'Continuous');
          reports.forEach((report, index) => {
              const isLastReport = index === reports.length - 1;
              const pageBreakClass = isLastReport ? '' : 'page-break';
              const practicalMetaJson = JSON.stringify(report.practicalMetadata || []).replace(/'/g, "&apos;");
              const theoryMetaJson = JSON.stringify(report.metadata || {}).replace(/'/g, "&apos;");
              bulkHTML += `<div class="printable ${pageBreakClass} card" data-subject-type="${report.subject.type}" data-practical-meta='${practicalMetaJson}' data-theory-meta='${theoryMetaJson}' data-report-type='${reportType}'>`;
              if (reportType === 'Foil') bulkHTML += buildRegisterFoilReportHTML(report);
              else if (reportType === 'Final') bulkHTML += buildFinalAssessmentReportHTML(report);
              else bulkHTML += buildContinuousReportHTML(report);
              bulkHTML += `</div>`;
          });
          reportOutput.innerHTML = bulkHTML;
          document.getElementById('reportActionButtons').style.display = 'flex';
          document.getElementById('exportPdfBtn').style.display = 'inline-flex';
          document.getElementById('exportAttendancePdfBtn').style.display = 'none';
          document.getElementById('exportConsolidatedPdfBtn').style.display = 'none';
}
function buildRegisterFoilReportHTML(report) {
          const {
              subject,
              studentData,
              metadata,
              practicalMetadata
          } = report;
          const {
              entryMax,
              calcMax
          } = subject;
          let dateHtml, teacherHtml;
          if (subject.type === 'Practical') {
              const dateString = practicalMetadata.map(p => `<strong>Batch ${p.batch.match(/(\w)/)[1]}:</strong> ${p.date ? new Date(p.date + 'T00:00:00').toLocaleDateString('en-GB') : 'N/A'}`).join(', ');
              const teacherString = practicalMetadata.map(p => `<strong>Batch ${p.batch.match(/(\w)/)[1]}:</strong> ${p.teacher || '_________________'}`).join('<br>');
              dateHtml = `<div class="report-details-foil"><span><strong>Subject:</strong> ${subject.fullName}</span></div><div class="report-details-practical"><div><strong>Date:</strong> ${dateString}</div></div>`;
              teacherHtml = `<div style="margin-top: 40px; text-align: left;"><strong>Subject Teacher:</strong><br>${teacherString}</div>`;
          } else {
              dateHtml = `<div class="report-details-foil"><span><strong>Subject:</strong> ${subject.fullName}</span><span><strong>Date:</strong> ${metadata.date ||'N/A'}</span></div>`;
              teacherHtml = `<div style="margin-top: 40px; text-align: right;"><strong>Subject Teacher:</strong> ${metadata.teacher || '_________________'}</div>`;
          }
          return `<div class="report-header-foil"><img src="${collegeLogoUrl}" class="report-logo"><div class="report-header-text-foil"><h3>${collegeName.toUpperCase()}</h3><p>${collegeAddress}</p></div></div>
            <div class="report-details-foil"><span><strong>Session:</strong> ${document.getElementById('reportSessionSelect').value}</span><span><strong>Class:</strong> ${subject.semester.replace("Sem ", "")} SEM</span><span><strong>MM:</strong> ${calcMax}</span></div>
            ${dateHtml}
            <table><thead><tr><th>Roll No.</th><th>Name</th><th>Father's Name</th><th>Marks (Out of ${entryMax})</th><th>Marks (Out of ${calcMax})</th><th>Marks in words</th></tr></thead><tbody>
            ${studentData.map(student => { const calculatedMark = student.marks ? Math.round(student.marks / entryMax * calcMax) : ''; return `<tr><td>${student.rollNo}</td><td>${toTitleCase(student.name)}</td><td>${toTitleCase(student.fathersName)}</td><td>${student.marks}</td><td>${calculatedMark}</td><td>${numberToWords(calculatedMark)}</td></tr>`;}).join('')}
            </tbody></table>
            ${teacherHtml}`;
}
function buildFinalAssessmentReportHTML(report) {
          const {
              subject,
              studentData,
              metadata,
              practicalMetadata
          } = report;
          const finalMM = subject.type === 'Theory' ? 25 : 15;
          const avgSessionalMM = subject.type === 'Theory' ? 15 : 10;
          const contMM = subject.type === 'Theory' ? 10 : 5;
          let teacherHtml;
          if (subject.type === 'Practical') {
              const teacherString = practicalMetadata.map(p => `<strong>Batch ${p.batch.match(/(\w)/)[1]}:</strong> ${p.teacher || '_________________'}`).join('<br>');
              teacherHtml = `<div style="margin-top: 40px; text-align: left;"><strong>Subject Teacher:</strong><br>${teacherString}</div>`;
          } else {
              teacherHtml = `<div style="margin-top: 40px; text-align: right;"><strong>Subject Teacher:</strong> ${metadata.teacher ||'_________________'}</div>`;
          }
          return `<div class="report-header-foil"><img src="${collegeLogoUrl}" class="report-logo"><div class="report-header-text-foil"><h3>${collegeName.toUpperCase()}</h3><p>${collegeAddress}</p></div></div>
            <div class="report-details-foil"><span><strong>Session:</strong> ${document.getElementById('reportSessionSelect').value}</span><span><strong>Class:</strong> ${subject.semester.replace("Sem ", "")} SEM</span><span><strong>MM:</strong> ${finalMM}</span></div>
            <div class="report-details-foil"><span><strong>Subject:</strong> ${subject.fullName}</span><span><strong>Date:</strong> ${metadata.date ||'N/A'}</span></div>
            <table><thead><tr><th>Roll No.</th><th>Name</th><th>Father's Name</th><th>Average of Sessional (${avgSessionalMM})</th><th>Continuous Mode (${contMM})</th><th>Final Assessment (${finalMM})</th><th>Marks in words</th></tr></thead><tbody>
            ${studentData.map(student => `<tr><td>${student.rollNo}</td><td>${toTitleCase(student.name)}</td><td>${toTitleCase(student.fathersName)}</td><td>${student.avgSessional}</td><td>${student.contMarks}</td><td>${student.finalAssessment}</td><td>${numberToWords(student.finalAssessment)}</td></tr>`).join('')}
            </tbody></table>
            ${teacherHtml}`;
}
function buildContinuousReportHTML(report) {
          const {
              subject,
              studentData,
              metadata,
              practicalMetadata
          } = report;
          const totalMM = subject.type === 'Theory' ? 10 : 5;
          const headerCols = subject.type === 'Theory' ?
          `<th>Attendance (4)</th><th>Academic Activity (3)</th><th>Interaction (3)</th>` : `<th>Attendance (2)</th><th>Academic Activity (3)</th>`;
          let teacherHtml;
          if (subject.type === 'Practical') {
              const teacherString = practicalMetadata.map(p => `<strong>Batch ${p.batch.match(/(\w)/)[1]}:</strong> ${p.teacher || '_________________'}`).join('<br>');
              teacherHtml = `<div style="margin-top: 40px; text-align: left;"><strong>Subject Teacher:</strong><br>${teacherString}</div>`;
          } else {
              teacherHtml = `<div style="margin-top: 40px; text-align: right;"><strong>Subject Teacher:</strong> ${metadata.teacher ||'_________________'}</div>`;
          }
          return `<div class="report-header-foil"><img src="${collegeLogoUrl}" class="report-logo"><div class="report-header-text-foil"><h3>${collegeName.toUpperCase()}</h3><p>${collegeAddress}</p></div></div>
            <div class="report-details-foil"><span><strong>Session:</strong> ${document.getElementById('reportSessionSelect').value}</span><span><strong>Class:</strong> ${subject.semester.replace("Sem ", "")} SEM</span><span><strong>Continuous Mode MM:</strong> ${totalMM}</span></div>
            <div class="report-details-foil"><span><strong>Subject (${subject.type}):</strong> ${subject.fullName}</span></div>
            <table><thead><tr><th>Roll No.</th><th>Name</th><th>Father's Name</th>${headerCols}<th>Total (${totalMM})</th><th>Marks in words</th></tr></thead><tbody>
            ${studentData.map(student => `<tr><td>${student.rollNo}</td><td>${toTitleCase(student.name)}</td><td>${toTitleCase(student.fathersName)}</td><td>${student.att}</td><td>${student.act}</td>${subject.type === 'Theory' ?`<td>${student.int}</td>` : ''}<td>${student.total}</td><td>${numberToWords(student.total)}</td></tr>`).join('')}
            </tbody></table>
            ${teacherHtml}`;
}
function toggleReportBatchSelector() {
          const subjectCode = document.getElementById('reportSubjectSelect').value;
          const batchSelect = document.getElementById('reportBatchSelect');
          const subject = allSubjects.find(s => s.code === subjectCode);
          if (subject && subject.type === 'Practical') {
              batchSelect.style.display = 'block';
          } else {
              batchSelect.style.display = 'none';
              batchSelect.value = 'all';
          }
}
function buildAttendanceRegister(data, criteria = {}) {
    const container = document.getElementById('attendanceList');
    if (!data || !data.students || data.students.length === 0) {
        container.innerHTML = "<p>No data available for this selection.</p>";
        document.getElementById('registerActionButtons').style.display = 'none';
        return;
    }

    lastRegisterData = data;
    lastRegisterCriteria = criteria || data.criteria || lastRegisterCriteria || {};
    const students = data.students || [];
    const dates = data.dates || [];
    const attendanceData = data.attendanceData || {};
    const subjectName = data.subjectName || '';

    let html = `<div class="card printable">
      <div class="report-header-foil">
        ${collegeLogoUrl ? `<img src="${collegeLogoUrl}" class="report-logo">` : ''}
        <div class="report-header-text-foil">
          <h3>${collegeName || ''}</h3>
          <p>${collegeAddress || ''}</p>
          <h4>Attendance Register</h4>
        </div>
      </div>
      <div class="report-details-foil">
        <span><strong>Session:</strong> ${lastRegisterCriteria.session || ''}</span>
        <span><strong>Semester:</strong> ${lastRegisterCriteria.semester || ''}</span>
      </div>
      <div class="report-details-foil">
        <span><strong>Subject:</strong> ${subjectName}</span>
        <span><strong>Teacher:</strong> ${toTitleCase(lastRegisterCriteria.teacher || '')}</span>
      </div>
      
      <div class="report-details-foil">
        <span><strong>Total Lectures:</strong> ${data.totalLectures || 0}</span>
      </div>
      <div style="overflow-x:auto;">
        <table>
          <thead>
            <tr>
              <th style="min-width:50px;">Roll No.</th>
              <th style="min-width:150px;">Name</th>
              <th style="min-width:150px;">Father's Name</th>`;
    dates.forEach(lectureKey => {
        html += `<th class="rotate-text"><div class="rotated-header">${lectureKey}</div></th>`;
    });
    html += `</tr></thead><tbody>`;

    students.forEach(student => {
        const roll = String(student[0] || '');
        const sName = toTitleCase(String(student[1] || ''));
        const fName = toTitleCase(String(student[2] || ''));

        html += `<tr>
            <td style="text-align:center;">${roll}</td>
            <td>${sName}</td>
            <td>${fName}</td>`;

        dates.forEach(lectureKey => {
            const status = (attendanceData[roll] && attendanceData[roll][lectureKey]) || '';
            html += `<td style="text-align:center;">${status}</td>`;
        });
        html += `</tr>`;
    });
    html += `</tbody></table></div></div>`;
    container.innerHTML = html;
    const regButtons = document.getElementById('registerActionButtons');
    if (regButtons) regButtons.style.display = 'flex';
    const exportBtn = document.getElementById('exportRegisterPdfBtn');
    if (exportBtn) exportBtn.style.display = 'inline-flex';
}
async function handleAttendanceReport() {
          const session = document.getElementById('reportSessionSelect').value;
          const semester = document.getElementById('reportSemesterSelect').value;
          const subjectSelect = document.getElementById('reportSubjectSelect');
          const subjectCode = subjectSelect.value;
          const batch = document.getElementById('reportBatchSelect').value;
          if (!session || !semester || !subjectCode) {
              alert("Please select a Session, Semester, and Subject.");
              return;
          }
          document.getElementById('reportOutput').innerHTML = `<div class="card"><p class="status-message status-loading">Generating Attendance Report...</p></div>`;
          document.getElementById('reportActionButtons').style.display = 'none';

          const criteria = {
              session: session,
              semester: semester,
              subjectCode: subjectCode,
              subjectName: subjectSelect.options[subjectSelect.selectedIndex].text,
              batch: batch
          };
          try {
            const data = await callAppsScript('getAttendanceReportData', [criteria]);
            buildSubjectAttendanceReport(data);
          } catch(e) {
            // error handled
          }
}
function buildSubjectAttendanceReport(data) {
          const reportOutput = document.getElementById('reportOutput');
          if (data.error) {
              reportOutput.innerHTML = `<div class='card'><p class="status-message status-error">${data.error}</p></div>`;
              return;
          }
          let finalHTML = '';
          const reportData = data.isTheory ? [data.report] : data.reports;
          if (reportData.length === 0) {
              reportOutput.innerHTML = "<div class='card'><p>No attendance data found for the selected batch(es).</p></div>";
              return;
          }
          reportData.forEach(report => {
              const {
                  criteria,
                  students,
                  teacherName
              } = report;
  
              let tableRows = students.map(student => `<tr><td>${student.rollNo}</td><td>${toTitleCase(student.name)}</td><td>${toTitleCase(student.fathersName)}</td><td>${student.attended}</td><td>${student.percentage.toFixed(2)}%</td></tr>`).join('');
              const batchTitle = criteria.batch ? ` (Batch ${criteria.batch})` : '';
              finalHTML += `<div class="printable card page-break">
                 <div class="report-header-foil"><img src="${collegeLogoUrl}" class="report-logo"><div class="report-header-text-foil"><h3>${collegeName.toUpperCase()}</h3><p>${collegeAddress}</p><h4>Attendance Report${batchTitle}</h4></div></div>
                <div class="report-details-foil"><span><strong>Session:</strong> ${criteria.session}</span><span><strong>Semester:</strong> ${criteria.semester}</span></div>
                <div class="report-details-foil"><span><strong>Subject:</strong> ${criteria.subjectName}</span><span><strong>Total Lectures:</strong> ${criteria.totalLectures}</span></div>
                <table><thead><tr><th>Roll No.</th><th>Name</th><th>Father's Name</th><th>Lectures Attended</th><th>Attendance %</th></tr></thead><tbody>${tableRows}</tbody></table>
                <div style="margin-top: 40px; text-align: right;"><strong>Subject Teacher:</strong> ${teacherName || '_________________'}</div>
            </div>`;
          });
          reportOutput.innerHTML = finalHTML;
          document.getElementById('reportActionButtons').style.display = 'flex';
          document.getElementById('exportPdfBtn').style.display = 'none';
          document.getElementById('exportAttendancePdfBtn').style.display = 'inline-flex';
          document.getElementById('exportConsolidatedPdfBtn').style.display = 'none';
}
async function handleConsolidatedReport() {
          const session = document.getElementById('reportSessionSelect').value;
          const semester = document.getElementById('reportSemesterSelect').value;
          if (!session || !semester) {
              alert("Please select a Session and Semester.");
              return;
          }
          document.getElementById('reportOutput').innerHTML = `<div class="card"><p class="status-message status-loading">Generating Consolidated Report...</p></div>`;
          document.getElementById('reportActionButtons').style.display = 'none';
          const criteria = { session, semester };
          try {
            const data = await callAppsScript('getConsolidatedAttendanceReport', [criteria]);
            buildConsolidatedReport(data);
          } catch(e) {
            // error handled
          }
}
function buildConsolidatedReport(data) {
    const reportOutput = document.getElementById('reportOutput');
    const { subjects, students, criteria } = data;
    
    let headerHTML = '<th>Roll No</th><th>Name</th><th>Father\'s Name</th>';
    subjects.forEach(sub => {
        let totalText = '';
        if (sub.type === 'Practical' && Object.keys(sub.totalLecturesByBatch).length > 0) {
            totalText = Object.entries(sub.totalLecturesByBatch)
                .map(([batch, count]) => `${batch}:${count}`)
                .join(', ');
        } else {
            totalText = sub.totalLecturesByBatch['Theory'] || 0;
        }
        headerHTML += `<th>${sub.code}<br><small>(${totalText})</small></th>`;
    });
    headerHTML += '<th>Total Attended</th><th>Overall %</th>';
    let bodyHTML = '';
    students.forEach(student => {
        let rowHTML = `<td>${student.rollNo}</td><td>${toTitleCase(student.name)}</td><td>${toTitleCase(student.fathersName)}</td>`;
        subjects.forEach(sub => {
            const attendanceValue = student.attendance[sub.code];
            rowHTML += `<td>${attendanceValue}</td>`;
        });
        rowHTML += `<td>${student.totalAttended}</td><td>${student.overallPercentage.toFixed(2)}%</td>`;
        bodyHTML += `<tr>${rowHTML}</tr>`;
    });

    const reportHTML = `<div class="printable card">
          <div class="report-header-foil"><img src="${collegeLogoUrl}" class="report-logo"><div class="report-header-text-foil"><h3>${collegeName.toUpperCase()}</h3><p>${collegeAddress}</p><h4>Consolidated Attendance Report</h4></div></div>
          <div class="report-details-foil"><span><strong>Session:</strong> ${criteria.session}</span><span><strong>Semester:</strong> ${criteria.semester}</span></div>
          <div style="overflow-x:auto;"><table><thead><tr>${headerHTML}</tr></thead><tbody>${bodyHTML}</tbody></table></div>
      </div>`;
    reportOutput.innerHTML = reportHTML;
    document.getElementById('reportActionButtons').style.display = 'flex';
    document.getElementById('exportPdfBtn').style.display = 'none';
    document.getElementById('exportAttendancePdfBtn').style.display = 'none';
    document.getElementById('exportConsolidatedPdfBtn').style.display = 'inline-flex';
}
async function handleReportCardGeneration() {
          const session = document.getElementById('reportCardSessionSelect').value,
              semester = document.getElementById('reportCardSemesterSelect').value,
              sessional = document.getElementById('reportCardSessionalSelect').value,
              rollNo = document.getElementById('reportCardRollNoSelect').value;
          if (!session || !semester || !sessional || !rollNo) {
              alert("Please select all criteria.");
              return;
          }
          const outputDiv = document.getElementById('reportCardOutput');
          outputDiv.innerHTML = `<div class="card"><p class="status-message status-loading">Generating Report Card(s)...</p></div>`;
          document.getElementById('reportCardActionButtons').style.display = 'none';
          const criteria = { session, semester, sessional, rollNo };
          try {
            const data = await callAppsScript('getSessionalReportCardData', [criteria]);
            buildReportCards(data);
          } catch(e) {
            // error handled
          }
}
function buildReportCards(data) {
          const outputDiv = document.getElementById('reportCardOutput'),
              actionButtons = document.getElementById('reportCardActionButtons');
          if (data.error) {
              outputDiv.innerHTML = `<div class="card"><p class="status-message status-error">Error: ${data.error}</p></div>`;
              actionButtons.style.display = 'none';
              return;
          }
          if (!data || data.length === 0) {
              outputDiv.innerHTML = "<div class='card'><p>No data found.</p></div>";
              actionButtons.style.display = 'none';
              return;
          }
          let bulkHTML = '';
          data.forEach((reportData, index) => bulkHTML += buildSingleReportCardHTML(reportData, index === data.length - 1));
          outputDiv.innerHTML = bulkHTML;
          actionButtons.style.display = 'flex';
}
function buildSingleReportCardHTML(data, isLast) {
          const {
              student,
              marks,
              summary,
              session,
              semester,
              sessional
          } = data;
          const pageBreakClass = isLast ? '' : 'page-break';
          const marksRows = marks.map(subject => `<tr><td>${subject.code} - ${subject.name}</td><td>${subject.sessionalMarks}</td><td>${subject.maxMarks}</td><td class="${subject.status === 'Pass' ? 'status-completed' : 'status-incomplete'}">${subject.status}</td></tr>`).join('');
          return `<div class="printable card ${pageBreakClass}" data-rollno="${student.rollNo}" data-name="${student.name}">
            <div class="report-card-header">
                <img src="${collegeLogoUrl}" alt="College Logo" class="report-logo"><div class="report-college-details"><p class="report-college-name">${collegeName.toUpperCase()}</p><p class="report-college-address">${collegeAddress}</p></div><div style="width: 80px;"></div>
            </div>
            <div class="report-title"><h4>SEMESTER REPORT CARD (${sessional})</h4></div>
            <div class="report-session"><p><strong>Session:</strong> ${session}</p></div>
            <div class="student-details-grid">
                <span><strong>Student Name:</strong> ${toTitleCase(student.name)}</span><span><strong>Program:</strong> B.Pharmacy</span>
                <span><strong>Father's Name:</strong> ${toTitleCase(student.fathersName)}</span><span><strong>Semester:</strong> ${semester.replace("Sem", "")}</span>
                <span><strong>Roll No:</strong> ${student.rollNo}</span>
            </div>
            <table><thead><tr><th>Subject Code & Name</th><th>Sessional Marks</th><th>Maximum Marks</th><th>Status</th></tr></thead><tbody>${marksRows}</tbody></table>
            <div class="summary-grid">
                <span><strong>Total Marks Obtained:</strong> ${summary.totalMarksObtained}</span><span><strong>Result:</strong> <span class="${summary.result === 'Pass' ?'status-completed' : 'status-incomplete'}">${summary.result}</span></span>
                <span><strong>Maximum Total Marks:</strong> ${summary.totalMaxMarks}</span><span><strong>Percentage:</strong> ${summary.percentage}%</span>
            </div>
            <div class="signature-section">
                <span>_________________________<br><strong>Date of Issue:</strong> ${new Date().toLocaleDateString('en-GB')}</span>
                <span>_________________________<br><strong>Principal / Director</strong></span>
            </div>
         </div>`;
}
async function loadStatusDashboard() {
    const session = document.getElementById('statusSessionSelect').value;
    const semester = document.getElementById('statusSemesterSelect').value;
    if (!session || !semester) {
        document.getElementById('statusOutput').innerHTML = '';
        return;
    }
    document.getElementById('statusOutput').innerHTML = '<p class="status-loading">Loading Status...</p>';
    try {
        const statuses = await callAppsScript('getSubjectStatuses', [session, semester]);
        buildStatusTable(statuses);
    } catch(e) {
    }
}
function buildStatusTable(statuses) {
          const statusOutput = document.getElementById('statusOutput');
          if (!statuses || statuses.length === 0) {
              statusOutput.innerHTML = "<p>No subjects found for this semester.</p>";
              return;
          }
          let tableHTML = '<table><thead><tr><th>Subject Name</th><th>Sessional 1</th><th>Sessional 2</th><th>Continuous Mode</th></tr></thead><tbody>';
          statuses.forEach(status => {
              tableHTML += `<tr><td>${status.subjectName}</td><td class="${status.sessional1_locked ? 'status-completed' : 'status-incomplete'}">${status.sessional1_locked ? 'Completed' : 'Incomplete'}</td><td class="${status.sessional2_locked ? 'status-completed' : 'status-incomplete'}">${status.sessional2_locked ? 'Completed' : 'Incomplete'}</td><td class="${status.continuous_locked ? 'status-completed' : 'status-incomplete'}">${status.continuous_locked ? 'Completed' : 'Incomplete'}</td></tr>`;
          });
          tableHTML += '</tbody></table>';
          statusOutput.innerHTML = tableHTML;
}
async function populateReportCardRollNumbers() {
          const session = document.getElementById('reportCardSessionSelect').value;
          const semester = document.getElementById('reportCardSemesterSelect').value;
          const rollNoSelect = document.getElementById('reportCardRollNoSelect');
          rollNoSelect.innerHTML = '<option value="">Loading Students...</option>';
          if (!session || !semester) {
              rollNoSelect.innerHTML = '<option value="">Select Session & Semester First</option>';
              return;
          }
          try {
            const students = await callAppsScript('getStudentList', [session, semester, null]);
            rollNoSelect.innerHTML = '';
            rollNoSelect.add(new Option('All Students (Whole Class)', 'WHOLE_CLASS'));
            students.forEach(student => rollNoSelect.add(new Option(`${student[0]} - ${student[1]}`, student[0])));
          } catch(e) {
            // error handled
          }
}
function exportFoilReportAsPDF() {
    const exportBtn = document.getElementById('exportPdfBtn');
    const originalBtnHTML = exportBtn.innerHTML;
    exportBtn.disabled = true;
    exportBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Exporting...';
    setTimeout(() => {
        try {
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');
            const reports = document.querySelectorAll('#reportOutput .printable');
            const drawDetailLine = (fullText, x, y, align = 'left', pdfInstance) => {
                const parts = fullText.split(':');
                const label = parts[0] + ':';
                const value = parts.length > 1 ? ' ' + parts.slice(1).join(':').trim() : '';
                pdfInstance.setFont('times', 'bold');
                const labelWidth = pdfInstance.getStringUnitWidth(label) * pdfInstance.internal.getFontSize() / pdfInstance.internal.scaleFactor;
                pdfInstance.setFont('times', 'normal');
                const valueWidth = pdfInstance.getStringUnitWidth(value) * pdfInstance.internal.getFontSize() / pdfInstance.internal.scaleFactor;
                const totalWidth = labelWidth + valueWidth;
                if (align === 'right') {
                    pdfInstance.setFont('times', 'normal'); pdfInstance.text(value, x, y, { align: 'right' });
                    pdfInstance.setFont('times', 'bold'); pdfInstance.text(label, x - valueWidth, y, { align: 'right' });
                } else {
                    let startX = x; if (align === 'center') { startX = (pdfInstance.internal.pageSize.getWidth() / 2) - (totalWidth / 2); }
                    pdfInstance.setFont('times', 'bold'); pdfInstance.text(label, startX, y);
                    pdfInstance.setFont('times', 'normal'); pdfInstance.text(value, startX + labelWidth, y);
                }
            };
            let academicReportsFound = 0;
            reports.forEach((reportHtml) => {
                if (!reportHtml.dataset.reportType) { return; }
                academicReportsFound++;
                const table = reportHtml.querySelector('table');
                if (!table) return;
                if (academicReportsFound > 1) pdf.addPage();
                const practicalMeta = JSON.parse((reportHtml.dataset.practicalMeta || '[]').replace(/&apos;/g, "'"));
                const theoryMeta = JSON.parse((reportHtml.dataset.theoryMeta || '{}').replace(/&apos;/g, "'"));
                const subjectType = reportHtml.dataset.subjectType;
                const reportType = reportHtml.dataset.reportType;
                const headerDetails = reportHtml.querySelector('.report-details-foil');
                const session = headerDetails.children[0].innerText.replace('Session:', '').trim();
                const semester = headerDetails.children[1].innerText.replace('Class:', '').trim();
                const mm = headerDetails.children[2].innerText.replace(/MM:|Continuous Mode MM:/, '').trim();
                let subjectText = '';
                const allSpans = reportHtml.querySelectorAll('.report-details-foil span, .report-details-practical div');
                for (const span of allSpans) { if (span.textContent.includes('Subject')) { subjectText = span.textContent; break; } }
                const subject = subjectText.replace(/Subject \(.*?\):|Subject:/, '').trim();
                let date, teacherText;
                if (subjectType === 'Practical') {
                    date = practicalMeta.map(p => `Batch ${p.batch.match(/Batch\s(\w)/)[1]}: ${p.date ? new Date(p.date + 'T00:00:00').toLocaleDateString('en-GB') : 'N/A'}`).join(', ');
                    teacherText = practicalMeta.map(p => `Batch ${p.batch.match(/Batch\s(\w)/)[1]}: ${p.teacher || '_________________'}`);
                } else {
                    date = theoryMeta.date || 'N/A';
                    teacherText = theoryMeta.teacher || '_________________';
                }
                const head = [Array.from(table.querySelectorAll('thead th')).map(th => th.innerText)];
                const body = Array.from(table.querySelectorAll('tbody tr')).map(tr => Array.from(tr.querySelectorAll('td')).map(td => td.innerText));
                const margin = 15;
                const pageWidth = pdf.internal.pageSize.getWidth();
                let currentY = margin;
                if (collegeLogoUrl) pdf.addImage(collegeLogoUrl, 'PNG', margin, currentY, 20, 20);
                pdf.setFont('times', 'bold'); pdf.setFontSize(16);
                pdf.text(collegeName.toUpperCase(), pageWidth / 2, currentY + 8, { align: 'center' });
                pdf.setFont('times', 'normal'); pdf.setFontSize(12);
                pdf.text(collegeAddress, pageWidth / 2, currentY + 15, { align: 'center' });
                currentY += 30;
                pdf.setFontSize(11);
                drawDetailLine(`Session: ${session}`, margin, currentY, 'left', pdf);
                drawDetailLine(`Class: ${semester}`, 0, currentY, 'center', pdf);
                drawDetailLine(`MM: ${mm}`, pageWidth - margin, currentY, 'right', pdf);
                currentY += 7;
                drawDetailLine(`Subject: ${subject}`, margin, currentY, 'left', pdf);
                if (reportType !== 'Continuous' && subjectType !== 'Practical') { drawDetailLine(`Date: ${date}`, pageWidth - margin, currentY, 'right', pdf); }
                currentY += 7;
                if (reportType !== 'Continuous' && subjectType === 'Practical') { drawDetailLine(`Date: ${date}`, margin, currentY, 'left', pdf); currentY += 7; }
                pdf.autoTable({
                    head, body, startY: currentY, theme: 'grid',
                    styles: { font: 'times', fontSize: 11, lineColor: [0, 0, 0], lineWidth: 0.1 },
                    headStyles: { fontStyle: 'bold', fillColor: [230, 230, 230], textColor: [0, 0, 0] },
                    margin: { left: margin, right: margin }
                });
                let finalY = pdf.autoTable.previous.finalY;
                pdf.setFont('times', 'bold'); pdf.setFontSize(11);
                if (subjectType === 'Practical') {
                    pdf.text('Subject Teacher:', margin, finalY + 15);
                    pdf.setFont('times', 'normal');
                    teacherText.forEach((line, index) => pdf.text(line, margin, finalY + 20 + (index * 5)));
                } else {
                    pdf.text(`Subject Teacher: ${teacherText}`, pageWidth - margin, finalY + 20, { align: 'right' });
                }
            });
            if (academicReportsFound > 0) {
                const pageCount = pdf.internal.getNumberOfPages();
                for (let i = 1; i <= pageCount; i++) {
                    pdf.setPage(i);
                    pdf.setFont('times', 'normal'); pdf.setFontSize(10);
                    pdf.text(`Page ${i} of ${pageCount}`, pdf.internal.pageSize.getWidth() - 15, pdf.internal.pageSize.getHeight() - 10, { align: 'right' });
                }
                const subjectSelect = document.getElementById('reportSubjectSelect');
                const selectedSubjectText = subjectSelect.options[subjectSelect.selectedIndex].text;
                let filename = subjectSelect.value === 'all' ? `Report_${document.getElementById('reportSemesterSelect').value}_All_Subjects.pdf` : `${selectedSubjectText.replace(/[^a-z0-9]/gi, '_')}.pdf`;
                pdf.save(filename);
            } else {
                alert("The currently displayed report is not compatible with this PDF export function. Please use this button for Foil, Continuous, and Final Assessment reports only.");
            }
        } catch (error) {
            console.error("PDF Export failed:", error); alert("Could not generate PDF. Check console for details.");
        } finally {
            exportBtn.disabled = false; exportBtn.innerHTML = originalBtnHTML;
        }
    }, 10);
}
function exportAttendanceReportAsPDF() {
    const exportBtn = document.getElementById('exportAttendancePdfBtn');
    const originalBtnHTML = exportBtn.innerHTML;
    exportBtn.disabled = true;
    exportBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Exporting...';
    setTimeout(() => {
        try {
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');
            const reports = document.querySelectorAll('#reportOutput .printable');
            if (reports.length === 0) { alert("Could not find a report to export."); return; }
            let pagesAdded = 0;
            reports.forEach(reportHtml => {
                if (pagesAdded > 0) { pdf.addPage(); }
                const table = reportHtml.querySelector('table');
                if (!table) return;
                const reportTitle = reportHtml.querySelector('.report-header-text-foil h4')?.innerText || "Attendance Report";
                const headerSpans = reportHtml.querySelectorAll('.report-details-foil span');
                const session = headerSpans[0] ? headerSpans[0].innerText : '';
                const semester = headerSpans[1] ? headerSpans[1].innerText : '';
                const subject = headerSpans[2] ? headerSpans[2].innerText : '';
                const totalLectures = headerSpans[3] ? headerSpans[3].innerText : '';
                const teacherName = reportHtml.querySelector('div[style*="text-align: right"]')?.innerText || "Subject Teacher: N/A";
                const head = [Array.from(table.querySelectorAll('thead th')).map(th => th.innerText)];
                const body = Array.from(table.querySelectorAll('tbody tr')).map(tr => Array.from(tr.querySelectorAll('td')).map(td => td.innerText));
                const margin = 15;
                const pageWidth = pdf.internal.pageSize.getWidth();
                let currentY = margin;
                if (collegeLogoUrl) { pdf.addImage(collegeLogoUrl, 'PNG', margin, currentY, 20, 20); }
                pdf.setFont('times', 'bold'); pdf.setFontSize(16);
                pdf.text(collegeName.toUpperCase(), pageWidth / 2, currentY + 8, { align: 'center' });
                pdf.setFont('times', 'normal'); pdf.setFontSize(12);
                pdf.text(collegeAddress, pageWidth / 2, currentY + 15, { align: 'center' });
                pdf.setFontSize(14); pdf.setFont('times', 'bold');
                pdf.text(reportTitle, pageWidth / 2, currentY + 22, { align: 'center' });
                currentY += 30;
                pdf.setFontSize(11); pdf.setFont('times', 'normal');
                pdf.text(session, margin, currentY);
                pdf.text(semester, pageWidth - margin, currentY, { align: 'right' });
                currentY += 7;
                pdf.text(subject, margin, currentY);
                pdf.text(totalLectures, pageWidth - margin, currentY, { align: 'right' });
                currentY += 7;
                pdf.autoTable({
                    head: head, body: body, startY: currentY,
                    theme: 'grid',
                    styles: { font: 'times', fontSize: 10, lineColor: [0, 0, 0], lineWidth: 0.1 },
                    headStyles: { fontStyle: 'bold', fillColor: [230, 230, 230], textColor: [0, 0, 0] },
                    margin: { left: margin, right: margin }
                });
                let finalY = pdf.autoTable.previous.finalY;
                pdf.setFont('times', 'normal'); pdf.setFontSize(11);
                pdf.text(teacherName, pageWidth - margin, finalY + 20, { align: 'right' });
                pagesAdded++;
            });
            const subjectText = document.querySelector('#reportSubjectSelect').options[document.querySelector('#reportSubjectSelect').selectedIndex].text;
            const filename = `${subjectText.replace(/[^a-z0-9]/gi, '_')}_Attendance.pdf`;
            pdf.save(filename);
        } catch (error) {
            console.error("Attendance PDF Export failed:", error);
            alert("Could not generate Attendance PDF. Check console for details.");
        } finally {
            exportBtn.disabled = false;
            exportBtn.innerHTML = originalBtnHTML;
        }
    }, 10);
}
function exportConsolidatedReportAsPDF() {
    const exportBtn = document.getElementById('exportConsolidatedPdfBtn');
    const originalBtnHTML = exportBtn.innerHTML;
    exportBtn.disabled = true;
    exportBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Exporting...';
    setTimeout(() => {
        try {
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('l', 'mm', 'a4');
            const reportHtml = document.querySelector('#reportOutput .printable');
            const table = reportHtml.querySelector('table');
            const headerSpans = reportHtml.querySelectorAll('.report-details-foil span');
            const session = headerSpans[0] ? headerSpans[0].innerText : '';
            const semester = headerSpans[1] ? headerSpans[1].innerText : '';
            html2canvas(table).then(canvas => {
                const margin = 15;
                const pageWidth = pdf.internal.pageSize.getWidth();
                let currentY = margin;
                if (collegeLogoUrl) pdf.addImage(collegeLogoUrl, 'PNG', margin, currentY, 20, 20);
                pdf.setFont('times', 'bold'); pdf.setFontSize(16);
                pdf.text(collegeName.toUpperCase(), pageWidth / 2, currentY + 8, { align: 'center' });
                pdf.setFont('times', 'normal'); pdf.setFontSize(12);
                pdf.text(collegeAddress, pageWidth / 2, currentY + 15, { align: 'center' });
                pdf.setFontSize(14); pdf.setFont('times', 'bold');
                pdf.text("Consolidated Attendance Report", pageWidth / 2, currentY + 22, { align: 'center' });
                currentY += 30;
                pdf.setFontSize(11); pdf.setFont('times', 'normal');
                pdf.text(session, margin, currentY);
                pdf.text(semester, pageWidth - margin, currentY, { align: 'right' });
                currentY += 10;
                const imgData = canvas.toDataURL('image/png');
                const imgProps = pdf.getImageProperties(imgData);
                const pdfWidth = pageWidth - 2 * margin;
                const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
                pdf.addImage(imgData, 'PNG', margin, currentY, pdfWidth, pdfHeight);
                pdf.save(`Consolidated_Attendance_${semester.replace('Semester: ','')}.pdf`);
            });
        } catch (error) {
            console.error("Consolidated PDF Export failed:", error); alert("Could not generate Consolidated PDF. Check console for details.");
        } finally {
            exportBtn.disabled = false; exportBtn.innerHTML = originalBtnHTML;
        }
    }, 10);
}
function exportAttendanceRegisterAsPDF() {
    if (!lastRegisterData || !lastRegisterData.students) {
        alert("Generate the Attendance Register first.");
        return;
    }
    const generatePdf = () => {
        const exportBtn = document.getElementById("exportRegisterPdfBtn");
        if (exportBtn) { exportBtn.disabled = true; exportBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Exporting...'; }
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ orientation: "landscape", format: "a4" });
            const pageWidth = doc.internal.pageSize.getWidth();
            const margin = 14; let y = 20;
            if (collegeLogoUrl) { try { doc.addImage(collegeLogoUrl, "PNG", margin, y - 12, 20, 20); } catch (e) { console.warn("Could not add logo to PDF.", e); } }
            doc.setFont("times", "bold").setFontSize(16); doc.text(collegeName || "", pageWidth / 2, y, { align: "center" });
            y += 6; doc.setFont("times", "normal").setFontSize(11); doc.text(collegeAddress || "", pageWidth / 2, y, { align: "center" });
            y += 10; doc.setFont("times", "bold").setFontSize(13); doc.text("Attendance Register", pageWidth / 2, y, { align: "center" });
            y += 10; doc.setFont("times", "bold").setFontSize(11);
            doc.text(`Session: ${lastRegisterCriteria.session || ""}`, margin, y);
            doc.text(`Semester: ${lastRegisterCriteria.semester || ""}`, pageWidth - margin, y, { align: "right" });
            y += 7;
            doc.text(`Subject: ${lastRegisterData.subjectName || ""}`, margin, y);
            doc.text(`Teacher: ${toTitleCase(lastRegisterCriteria.teacher || "")}`, pageWidth - margin, y, { align: "right" });
            y += 7; doc.text(`Total Lectures: ${lastRegisterData.totalLectures || 0}`, margin, y); y += 10;
            const head = [["Roll No", "Name", "Father's Name", ...lastRegisterData.dates]];
            const body = (lastRegisterData.students || []).map(s => {
                const row = [String(s[0] || ""), toTitleCase(String(s[1] || "")), toTitleCase(String(s[2] || ""))];
                lastRegisterData.dates.forEach(lectureKey => { const v = (lastRegisterData.attendanceData[row[0]] && lastRegisterData.attendanceData[row[0]][lectureKey]) || ""; row.push(v); });
                return row;
            });
            const dateHeaders = head[0].slice(3);
            const longestHeader = dateHeaders.reduce((a, b) => a.length > b.length ? a : b, "");
            doc.setFont("times", "bold"); doc.setFontSize(8); const textWidth = doc.getTextWidth(longestHeader);
            const requiredCellHeight = textWidth + 5;
            const columnStyles = { 0: { halign: "center", cellWidth: 20 }, 1: { halign: "left", cellWidth: 'auto' }, 2: { halign: "left", cellWidth: 'auto' }, };
            dateHeaders.forEach((_, index) => { columnStyles[index + 3] = { cellWidth: 12 }; });
            doc.autoTable({
                startY: y, head: head, body: body, theme: 'grid',
                styles: { font: "times", fontSize: 9, halign: "center", valign: "middle" },
                headStyles: { fontStyle: "bold", fillColor: [240, 240, 240], textColor: [0, 0, 0], valign: 'middle', halign: 'center', minCellHeight: requiredCellHeight },
                columnStyles: columnStyles,
                didParseCell: function (data) { if (data.row.section === 'head' && data.column.index >= 3) { data.cell.text = ''; } },
                didDrawCell: function (data) {
                    if (data.row.section === 'head' && data.column.index >= 3) {
                        const originalText = head[0][data.column.index];
                        doc.saveGraphicsState(); doc.setFont("times", "bold"); doc.setFontSize(8); doc.setTextColor(0, 0, 0);
                        const centerX = data.cell.x + data.cell.width / 2 + 6; const centerY = data.cell.y + data.cell.height / 2 - 8;
                        doc.text(originalText, centerX, centerY, { angle: -90, align: 'center', baseline: 'middle' });
                        doc.restoreGraphicsState();
                    }
                },
                margin: { left: margin, right: margin },
            });
            const sessionName = (lastRegisterCriteria.session || "").replace(/\s+/g, "_");
            const subj = String(lastRegisterData.subjectName || "").replace(/[^a-zA-Z0-9\-_]/g, "_").substring(0, 40);
            const filename = `Attendance_Register_${sessionName}_${subj || "subject"}.pdf`;
            doc.save(filename);
        } catch (err) {
            console.error("Attendance Register PDF export failed:", err); alert("Could not generate Attendance Register PDF. See console for details.");
        } finally {
            if (exportBtn) { exportBtn.disabled = false; exportBtn.innerHTML = '<i class="fa-solid fa-file-pdf"></i> Export Register PDF'; }
        }
    };
    if (!window.jspdf || !window.jspdf.autoTable) { loadPdfLibraries(generatePdf); } else { generatePdf(); }
}
function exportReportCardsAsPDF() {
    const exportBtn = document.getElementById('exportReportCardPdfBtn');
    const originalBtnHTML = exportBtn.innerHTML;
    exportBtn.disabled = true;
    exportBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Exporting...';
    setTimeout(() => {
        try {
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');
            const reports = document.querySelectorAll('#reportCardOutput .printable');
            const drawDetailLine = (fullText, x, y, align = 'left', pdfInstance) => {
                const parts = fullText.split(':');
                const label = parts[0] + ':';
                const value = parts.length > 1 ? ' ' + parts.slice(1).join(':').trim() : '';
                pdfInstance.setFont('times', 'bold');
                const labelWidth = pdfInstance.getStringUnitWidth(label) * pdfInstance.internal.getFontSize() / pdfInstance.internal.scaleFactor;
                pdfInstance.setFont('times', 'normal');
                const valueWidth = pdfInstance.getStringUnitWidth(value) * pdfInstance.internal.getFontSize() / pdfInstance.internal.scaleFactor;
                const totalWidth = labelWidth + valueWidth;
                if (align === 'right') {
                    pdfInstance.setFont('times', 'normal'); pdfInstance.text(value, x, y, { align: 'right' });
                    pdfInstance.setFont('times', 'bold'); pdfInstance.text(label, x - valueWidth, y, { align: 'right' });
                } else {
                    let startX = x; if (align === 'center') { startX = (pdfInstance.internal.pageSize.getWidth() / 2) - (totalWidth / 2); }
                    pdfInstance.setFont('times', 'bold'); pdfInstance.text(label, startX, y);
                    pdfInstance.setFont('times', 'normal'); pdfInstance.text(value, startX + labelWidth, y);
                }
            };
            if (reports.length === 0) {
                alert("No report cards found to export.");
            } else {
                let pagesAdded = 0;
                reports.forEach(reportHtml => {
                    if (pagesAdded > 0) pdf.addPage();
                    const studentDetails = Array.from(reportHtml.querySelectorAll('.student-details-grid span')).map(s => s.innerText);
                    const summaryDetails = Array.from(reportHtml.querySelectorAll('.summary-grid span')).map(s => s.innerText);
                    const table = reportHtml.querySelector('table');
                    const head = [Array.from(table.querySelectorAll('thead th')).map(th => th.innerText)];
                    const body = Array.from(table.querySelectorAll('tbody tr')).map(tr => Array.from(tr.querySelectorAll('td')).map(td => td.innerText));
                    const margin = 15;
                    const pageWidth = pdf.internal.pageSize.getWidth();
                    let currentY = margin;
                    if (collegeLogoUrl) pdf.addImage(collegeLogoUrl, 'PNG', margin, currentY, 20, 20);
                    pdf.setFont('times', 'bold'); pdf.setFontSize(16);
                    pdf.text(collegeName.toUpperCase(), pageWidth / 2, currentY + 8, { align: 'center' });
                    pdf.setFont('times', 'normal'); pdf.setFontSize(12);
                    pdf.text(collegeAddress, pageWidth / 2, currentY + 15, { align: 'center' });
                    currentY += 30;
                    pdf.setFont('times', 'bold'); pdf.setFontSize(14);
                    pdf.text(reportHtml.querySelector('.report-title h4').innerText, pageWidth / 2, currentY, { align: 'center' });
                    currentY += 8;
                    pdf.setFontSize(12);
                    drawDetailLine(reportHtml.querySelector('.report-session p').innerText, 0, currentY, 'center', pdf);
                    currentY += 10;
                    pdf.setFontSize(11);
                    drawDetailLine(studentDetails[0], margin, currentY, 'left', pdf);
                    drawDetailLine(studentDetails[1], pageWidth - margin, currentY, 'right', pdf);
                    currentY += 6;
                    drawDetailLine(studentDetails[2], margin, currentY, 'left', pdf);
                    drawDetailLine(studentDetails[3], pageWidth - margin, currentY, 'right', pdf);
                    currentY += 6;
                    drawDetailLine(studentDetails[4], margin, currentY, 'left', pdf);
                    currentY += 8;
                    pdf.autoTable({
                        head, body, startY: currentY,
                        theme: 'grid',
                        styles: { font: 'times', fontSize: 11, lineColor: [0, 0, 0], lineWidth: 0.1 },
                        headStyles: { fontStyle: 'bold', fillColor: [230, 230, 230], textColor: [0, 0, 0] },
                        margin: { left: margin, right: margin }
                    });
                    let finalY = pdf.autoTable.previous.finalY;
                    currentY = finalY + 10;
                    let totalMarksText = summaryDetails.find(t => t.toLowerCase().startsWith('total marks obtained:'));
                    let maxMarksText = summaryDetails.find(t => t.toLowerCase().startsWith('maximum total marks:'));
                    let resultText = summaryDetails.find(t => t.toLowerCase().startsWith('result:'));
                    let percentageText = summaryDetails.find(t => t.toLowerCase().startsWith('percentage:'));
                    if (totalMarksText) { drawDetailLine(totalMarksText, margin, currentY, 'left', pdf); }
                    if (resultText) { drawDetailLine(resultText, pageWidth - margin, currentY, 'right', pdf); }
                    currentY += 6;
                    if (maxMarksText) { drawDetailLine(maxMarksText, margin, currentY, 'left', pdf); }
                    if (percentageText) { drawDetailLine(percentageText, pageWidth - margin, currentY, 'right', pdf); }
                    const pageHeight = pdf.internal.pageSize.getHeight();
                    pdf.setFont('times', 'normal');
                    pdf.text('_________________________', margin, pageHeight - 30);
                    pdf.text('Date of Issue: ' + new Date().toLocaleDateString('en-GB'), margin, pageHeight - 25);
                    pdf.text('_________________________', pageWidth - margin, pageHeight - 30, { align: 'right' });
                    pdf.text('Principal / Director', pageWidth - margin, pageHeight - 25, { align: 'right' });
                    pagesAdded++;
                });
                if (pagesAdded > 0) {
                    const filename = reports.length === 1 ? `${reports[0].dataset.rollno}_${reports[0].dataset.name.replace(/ /g, '_')}.pdf` : 'AcadVista_Report_Cards.pdf';
                    pdf.save(filename);
                }
            }
        } catch (e) {
            console.error("PDF Export failed:", e); alert("Could not generate PDF. Check console for details.");
        } finally {
            exportBtn.disabled = false; exportBtn.innerHTML = originalBtnHTML;
        }
    }, 10);
}
async function loadStatusDashboard() {
    const session = document.getElementById('statusSessionSelect').value;
    const semester = document.getElementById('statusSemesterSelect').value;
    if (!session || !semester) {
        document.getElementById('statusOutput').innerHTML = '';
        return;
    }
    document.getElementById('statusOutput').innerHTML = '<p class="status-loading">Loading Status...</p>';
    try {
        const statuses = await callAppsScript('getSubjectStatuses', [session, semester]);
        buildStatusTable(statuses);
    } catch(e) {
    }
}
function buildStatusTable(statuses) {
          const statusOutput = document.getElementById('statusOutput');
          if (!statuses || statuses.length === 0) {
              statusOutput.innerHTML = "<p>No subjects found for this semester.</p>";
              return;
          }
          let tableHTML = '<table><thead><tr><th>Subject Name</th><th>Sessional 1</th><th>Sessional 2</th><th>Continuous Mode</th></tr></thead><tbody>';
          statuses.forEach(status => {
              tableHTML += `<tr><td>${status.subjectName}</td><td class="${status.sessional1_locked ? 'status-completed' : 'status-incomplete'}">${status.sessional1_locked ? 'Completed' : 'Incomplete'}</td><td class="${status.sessional2_locked ? 'status-completed' : 'status-incomplete'}">${status.sessional2_locked ? 'Completed' : 'Incomplete'}</td><td class="${status.continuous_locked ? 'status-completed' : 'status-incomplete'}">${status.continuous_locked ? 'Completed' : 'Incomplete'}</td></tr>`;
          });
          tableHTML += '</tbody></table>';
          statusOutput.innerHTML = tableHTML;
}
async function populateReportCardRollNumbers() {
          const session = document.getElementById('reportCardSessionSelect').value;
          const semester = document.getElementById('reportCardSemesterSelect').value;
          const rollNoSelect = document.getElementById('reportCardRollNoSelect');
          rollNoSelect.innerHTML = '<option value="">Loading Students...</option>';
          if (!session || !semester) {
              rollNoSelect.innerHTML = '<option value="">Select Session & Semester First</option>';
              return;
          }
          try {
            const students = await callAppsScript('getStudentList', [session, semester, null]);
            rollNoSelect.innerHTML = '';
            rollNoSelect.add(new Option('All Students (Whole Class)', 'WHOLE_CLASS'));
            students.forEach(student => rollNoSelect.add(new Option(`${student[0]} - ${student[1]}`, student[0])));
          } catch(e) {
            // error handled
          }

}







