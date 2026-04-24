const pageLimit = parseInt(process.env.pageLimit, 10);
const { renderTemplate } = require('../utils/template');
const { generatePdf } = require('../utils/pdf');
const prisma = require('../prisma');
const { serializeStudent } = require('../serializers/studentSerializer');
const { serializeParent } = require('../serializers/parentSerializer');

const getReceiptSearchFilter = (search) => {
  const textFilter = { contains: search, mode: 'insensitive' };
  return {
    OR: [
      { reference: textFilter },
      {
        monthlyFeeDetails: {
          some: {
            student: {
              OR: [
                { first_name: textFilter },
                { last_name: textFilter },
              ],
            },
          },
        },
      },
      {
        feeDetails: {
          some: {
            student: {
              OR: [
                { first_name: textFilter },
                { last_name: textFilter },
              ],
            },
          },
        },
      },
    ],
  };
};

exports.getReceipts = async (req, res) => {
  const search = req.query.search || '';
  const page = parseInt(req.query.page, pageLimit) || 1;
  const limit = parseInt(req.query.limit, pageLimit) || pageLimit;
  const offset = (page - 1) * limit;

  const where = {};
  if (search) Object.assign(where, getReceiptSearchFilter(search));

  try {
    const [count, receipts] = await Promise.all([
      prisma.receipt.count({ where }),
      prisma.receipt.findMany({
        where,
        include: {
          monthlyFeeDetails: {
            include: {
              student: {
                include: { parent: { include: { user: true } }, classe: { include: { grade: true } } },
              },
            },
          },
          feeDetails: {
            include: {
              student: { include: { parent: { include: { user: true } }, classe: { include: { grade: true } } } },
            },
          },
        },
        orderBy: { id_receipt: 'desc' },
        skip: offset,
        take: limit,
      }),
    ]);

    return res.json({ count, results: receipts });
  } catch (error) {
    console.error('Receipt download failed:', error);
    res.status(500).json({ error: error?.message || 'Server error' });
  }
};

exports.downloadReceipt = async (req, res) => {
  const id = parseInt(req.params.id, 10);

  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid receipt id' });
  } 

  try {
    const receipt = await prisma.receipt.findUnique({
      where: { id_receipt: id },
      include: {
        monthlyFeeDetails: {
          include: {
            student: { include: { parent: { include: { user: true } }, classe: true } },
          },
        },
        feeDetails: {
          include: {
            student: { include: { parent: { include: { user: true } }, classe: true } },
          },
        },
      },
    });

    if (!receipt) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    let receiptDetail = receipt.feeDetails[0] || null;
    let templateName = 'receiptfia.html';
    let month = '';

    if (!receiptDetail) {
      receiptDetail = receipt.monthlyFeeDetails[0] || null;
      templateName = 'receiptfsm.html';
    }

    if (!receiptDetail) {
      return res.status(404).json({ error: 'Receipt details not found' });
    }

    if (!receiptDetail.student) {
      console.error('Receipt detail student missing', {
        receiptId: id,
        receiptDetail,
      });
      return res.status(404).json({ error: 'Receipt student not found' });
    }

    const school = await prisma.schoolInfos.findFirst();

    const MONTH_NAMES = [
      'Janvier','Février','Mars','Avril','Mai','Juin',
      'Juillet','Août','Septembre','Octobre','Novembre','Décembre'
    ];

    if (templateName === 'receiptfsm.html' && receiptDetail.month) {
      month = MONTH_NAMES[parseInt(receiptDetail.month, 10) - 1] || '';
    }

    const student = serializeStudent(receiptDetail.student);
    const parent = serializeParent(student.parent || null);

    const html = renderTemplate(templateName, {
      school,
      student,
      parent,
      receipt,
      receipt_details: receiptDetail,
      month,
      date: new Date().toLocaleDateString('fr-FR'),
    });

    const pdfBuffer = await generatePdf(html);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="bulletin_${student.CNI}_${receipt.id_receipt}.pdf"`
    );

    res.send(pdfBuffer);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};
