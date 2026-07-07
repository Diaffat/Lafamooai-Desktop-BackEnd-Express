const prisma = require("../prisma");

const makePayment = async (id, createReceipt) => {

    const fee = await prisma.monthlyFeeDetails.findUnique({
        where: {
            id_mthl_fd: id,
        },
        include: {
            student: {
                include: {
                    classe: {
                        include: {
                            grade: true,
                        },
                    },
                },
            },
        },
    });

    if (!fee)
        throw new Error("PAYMENT_NOT_FOUND");

    if (fee.receiptId)
        throw new Error("ALREADY_PAID");

    if (!fee.student?.classe?.grade)
        throw new Error("INVALID_GRADE");

    return prisma.$transaction(async (tx) => {

        const amount = fee.student.classe.grade.monthly_fee;

        const receipt = await createReceipt(tx, amount);

        await tx.monthlyFeeDetails.update({
            where: {
                id_mthl_fd: fee.id_mthl_fd,
            },
            data: {
                receiptId: receipt.id_receipt,
            },
        });

        return {
            receipt,
            amount,
            month_status: "at_day",
        };

    });

};

module.exports = {
    makePayment,
};