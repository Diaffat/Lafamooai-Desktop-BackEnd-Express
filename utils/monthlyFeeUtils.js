const generateSchoolMonths = (startMonth, endMonth) => {
    const months = [];

    let current = startMonth;

    while (true) {

        months.push(current);

        if (current === endMonth)
            break;

        current++;

        if (current > 12)
            current = 1;
    }

    return months;
};

module.exports = {
    generateSchoolMonths
};