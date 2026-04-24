const prisma = require('../prisma');
const pageLimit = parseInt(process.env.pageLimit, 10);

// Appreciation scale function
const getAppreciation = (score) => {
  if (score < 5) return 'Médiocre';
  if (score >= 5 && score < 10) return 'Insuffisant';
  if (score >= 10 && score < 12) return 'Passable';
  if (score >= 12 && score < 14) return 'Assez bien';
  if (score >= 14 && score < 16) return 'Bien';
  if (score >= 16 && score < 18) return 'Très bien';
  return 'Excellent';
};

// Get all exam results with filtering and pagination
exports.getExamResults = async (req, res) => {
  try {
    const { search } = req.query;
    const page = parseInt(req.query.page, pageLimit) || 1;
    const limit = parseInt(req.query.limit, pageLimit) || pageLimit;

    const user = req.user;
    const where = {};

    // Search filter
    if (search) {
      where.student = {
        account: {
          username: { contains: search }
        }
      };
    }

    // Role-based filtering
    if (user.role === 'student') {
      const student = await prisma.student.findFirst({
        where: { accountId: user.id }
      });
      if (student) {
        where.studentId = student.id_student;
      }
    } else if (user.role === 'parent') {
      const students = await prisma.student.findMany({
        where: { parent: { user: { id: user.id } } }
      });
      if (students.length > 0) {
        const studentIds = students.map(s => s.id_student);
        where.studentId = { in: studentIds };
      } else {
        where.id_exam_result = { in: [] };
      }
    }

    const total = await prisma.examResult.count({ where });
    const results = await prisma.examResult.findMany({
      where,
      include: { student: true, exam: true },
      orderBy: { exam: { end_date: 'desc' } },
      skip: (page - 1) * limit,
      take: limit
    });

    res.json({ count: total, results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get exam result by ID
exports.getExamResultById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid exam result id' });
    }

    const result = await prisma.examResult.findUnique({
      where: { id_exam_result: id },
      include: { student: true, exam: true, classe: true }
    });

    if (!result) {
      return res.status(404).json({ error: 'Exam result not found' });
    }

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Create exam result
exports.createExamResult = async (req, res) => {
  try {
    const { examId, studentId, note, rank, mention, classeId } = req.body;

    const result = await prisma.examResult.create({
      data: {
        examId: parseInt(examId, 10),
        studentId: parseInt(studentId, 10),
        note: parseFloat(note),
        rank: parseInt(rank, 10),
        mention,
        classeId: parseInt(classeId, 10)
      },
      include: { student: true, exam: true }
    });

    res.status(201).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Update exam result
exports.updateExamResult = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid exam result id' });
    }

    const { note, rank, mention } = req.body;

    const result = await prisma.examResult.update({
      where: { id_exam_result: id },
      data: {
        ...(note !== undefined && { note: parseFloat(note) }),
        ...(rank !== undefined && { rank: parseInt(rank, 10) }),
        ...(mention && { mention })
      },
      include: { student: true, exam: true }
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Delete exam result
exports.deleteExamResult = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid exam result id' });
    }

    await prisma.examResult.delete({
      where: { id_exam_result: id }
    });

    res.json({ message: 'Exam result deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Generate reports for all classes in an exam
exports.generateReports = async (req, res) => {
  try {
    const { exam_id } = req.body;

    if (!exam_id) {
      return res.status(400).json({ error: 'exam_id is required' });
    }

    const exam = await prisma.exam.findUnique({
      where: { id_exam: parseInt(exam_id, 10) },
      include: { classes: true }
    });

    if (!exam) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    if (exam.status !== 'Corrected') {
      return res.status(400).json({ error: 'Exam status must be Corrected' });
    }

    for (const clss of exam.classes) {
      const subjects = await prisma.subject.findMany({
        where: { classeId: clss.id_class }
      });

      const students = await prisma.student.findMany({
        where: { classeId: clss.id_class }
      });

      const studentNotes = [];
      const notesList = [];
      const primaryNotes = {};

      for (const stdt of students) {
        const sbjCoeffs = [];
        const stdtNotes = [];

        for (const sbj of subjects) {
          const pryAssgn = await prisma.assignment.findFirst({
            where: {
              examId: exam.id_exam,
              subjectId: sbj.id_subject,
              asg_type: 'Primary_Note'
            }
          });

          if (!pryAssgn) continue;

          sbjCoeffs.push(sbj.coefficient);

          const pryAsgRslt = await prisma.assignmentResult.findFirst({
            where: {
              assignmentId: pryAssgn.id_assignment,
              studentId: stdt.id_student
            }
          });

          const pryNote = pryAsgRslt?.score || 0;
          const primaryScore = Math.round(pryNote * 100) / 100;

          if (!primaryNotes[pryAssgn.id_assignment]) {
            primaryNotes[pryAssgn.id_assignment] = [];
          }
          primaryNotes[pryAssgn.id_assignment].push(pryNote);

          if (sbj.secondary_note === 1) {
            const scdAssgns = await prisma.assignment.findMany({
              where: {
                examId: exam.id_exam,
                subjectId: sbj.id_subject,
                asg_type: 'Secondary_Note'
              }
            });

            const scdNotePrt = sbj.secondary_note_percent;
            const scdNoteSlt = sbj.secondary_note_selection;
            const scdNotes = [];

            for (const scAsg of scdAssgns) {
              const scAsgRslt = await prisma.assignmentResult.findFirst({
                where: {
                  assignmentId: scAsg.id_assignment,
                  studentId: stdt.id_student
                }
              });
              if (scAsgRslt) {
                scdNotes.push(scAsgRslt.score);
              }
            }

            let scdNotesAvg = 0;
            if (scdNotes.length > 0) {
              scdNotes.sort((a, b) => b - a);
              const selectedNotes = scdNoteSlt !== 0 ? scdNotes.slice(0, scdNoteSlt) : scdNotes;
              scdNotesAvg = selectedNotes.reduce((a, b) => a + b, 0) / selectedNotes.length;
            }

            const secondaryScore = Math.round(scdNotesAvg * 100) / 100;
            const sbjNote = (1 - scdNotePrt) * pryNote + scdNotePrt * scdNotesAvg;
            const finalScore = Math.round(sbjNote * 100) / 100;
            const coeffFinalScore = Math.round(sbjNote * sbj.coefficient * 100) / 100;

            await prisma.examResultDetails.create({
              data: {
                examId: exam.id_exam,
                studentId: stdt.id_student,
                subjectId: sbj.id_subject,
                primary_score: primaryScore,
                secondary_score: secondaryScore,
                final_score: finalScore,
                coeff_final_score: coeffFinalScore,
                appreciation: getAppreciation(finalScore)
              }
            });

            stdtNotes.push(sbjNote * sbj.coefficient);
          } else {
            const finalScore = primaryScore;
            const coeffFinalScore = Math.round(pryNote * sbj.coefficient * 100) / 100;

            await prisma.examResultDetails.create({
              data: {
                examId: exam.id_exam,
                studentId: stdt.id_student,
                subjectId: sbj.id_subject,
                primary_score: primaryScore,
                final_score: finalScore,
                coeff_final_score: coeffFinalScore,
                appreciation: getAppreciation(finalScore)
              }
            });

            stdtNotes.push(pryNote * sbj.coefficient);
          }
        }

        let examNote = 0;
        if (stdtNotes.length > 0 && sbjCoeffs.length > 0) {
          examNote = stdtNotes.reduce((a, b) => a + b, 0) / sbjCoeffs.reduce((a, b) => a + b, 0);
        }

        studentNotes.push({ student: stdt, note: examNote });
        notesList.push(examNote);
      }

      notesList.sort((a, b) => b - a);

      let acceptableScoreNum = 0;
      for (const stdtNote of studentNotes) {
        const rank = notesList.indexOf(stdtNote.note) + 1;
        if (stdtNote.note >= 10) {
          acceptableScoreNum++;
        }

        await prisma.examResult.create({
          data: {
            examId: exam.id_exam,
            studentId: stdtNote.student.id_student,
            note: Math.round(stdtNote.note * 100) / 100,
            rank,
            mention: getAppreciation(stdtNote.note),
            classeId: clss.id_class
          }
        });
      }

      for (const asgnId of Object.keys(primaryNotes)) {
        const assgn = await prisma.assignment.findUnique({
          where: { id_assignment: parseInt(asgnId, 10) },
          include: { subject: true }
        });

        if (assgn) {
          const notes = primaryNotes[asgnId];
          const maxScore = Math.max(...notes);
          const minScore = Math.min(...notes);
          const avgScore = notes.reduce((a, b) => a + b, 0) / notes.length;
          const acceptablePercent = (notes.filter(n => n >= 10).length / notes.length) * 100;

          await prisma.assignmentStatis.create({
            data: {
              examId: exam.id_exam,
              subjectId: assgn.subjectId,
              classeId: clss.id_class,
              max_score: Math.round(maxScore * 100) / 100,
              min_score: Math.round(minScore * 100) / 100,
              avg_score: Math.round(avgScore * 100) / 100,
              acceptable_score_percent: Math.round(acceptablePercent * 100) / 100
            }
          });
        }
      }

      if (notesList.length > 0) {
        await prisma.examStatis.create({
          data: {
            examId: exam.id_exam,
            classeId: clss.id_class,
            classe_size: notesList.length,
            best_note: Math.round(Math.max(...notesList) * 100) / 100,
            min_note: Math.round(Math.min(...notesList) * 100) / 100,
            avg_note: Math.round((notesList.reduce((a, b) => a + b, 0) / notesList.length) * 100) / 100,
            acceptable_score_percent: Math.round((acceptableScoreNum / notesList.length) * 100 * 100) / 100
          }
        });
      }
    }

    // Update exam status
    await prisma.exam.update({
      where: { id_exam: exam.id_exam },
      data: {
        status: 'Reported',
        reported_at: new Date()
      }
    });

    res.status(201).json({
      message: 'All reports created successfully',
      class_count: exam.classes.length
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get report details
exports.getReport = async (req, res) => {
  try {
    const examId = parseInt(req.query.exmid, 10);
    const studentId = parseInt(req.query.stdid, 10);

    if (Number.isNaN(examId) || Number.isNaN(studentId)) {
      return res.status(400).json({ error: 'Invalid exam or student id' });
    }

    const exam = await prisma.exam.findUnique({
      where: { id_exam: examId }
    });

    const student = await prisma.student.findUnique({
      where: { id_student: studentId }
    });

    if (!exam || !student) {
      return res.status(404).json({ error: 'Exam or student not found' });
    }

    const notes = await prisma.examResultDetails.findMany({
      where: { examId, studentId },
      include: { subject: true }
    });

    const results = await prisma.examResult.findFirst({
      where: { examId, studentId }
    });

    const examStatis = await prisma.examStatis.findFirst({
      where: { examId, classeId: student.classeId }
    });

    res.json({
      Message: 'Report details',
      Notes: notes,
      Results: results,
      Statistics: examStatis
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Download report as PDF (placeholder - requires pdf library)
exports.reportPdfDownloader = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid exam result id' });
    }

    const examResult = await prisma.examResult.findUnique({
      where: { id_exam_result: id },
      include: {
        student: { include: { classe: true } },
        exam: true
      }
    });

    if (!examResult) {
      return res.status(404).json({ error: 'Exam result not found' });
    }

    const examDetails = await prisma.examResultDetails.findMany({
      where: { examId: examResult.examId, studentId: examResult.studentId },
      include: { subject: true }
    });

    const school = await prisma.schoolInfos.findFirst();

    // Calculate totals
    let noteTotal = 0;
    let coeffTotal = 0;
    let noteCoeffTotal = 0;

    for (const detail of examDetails) {
      noteTotal += detail.final_score || 0;
      coeffTotal += detail.subject?.coefficient || 0;
      noteCoeffTotal += detail.coeff_final_score || 0;
    }

    // TODO: Implement PDF generation with a library like 'pdfkit' or 'html2pdf'
    // For now, returning JSON with report data

    res.json({
      message: 'Report PDF data (PDF generation requires pdf library setup)',
      report_data: {
        school,
        exam: examResult.exam,
        student: examResult.student,
        exam_result: examResult,
        exam_details: examDetails,
        note_total: Math.round(noteTotal * 100) / 100,
        coeff_total: coeffTotal,
        note_coeff_total: Math.round(noteCoeffTotal * 100) / 100
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};
