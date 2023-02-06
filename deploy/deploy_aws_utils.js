const readline = require('readline');


async function askSpecific(rl, question, arraySpecificAnswers) {
    return new Promise((resolve, reject) => {
        rl.question(`${question}:`, (answer) => {
            if(arraySpecificAnswers.includes(answer)) {
                resolve(answer)
            }
            else {
                askSpecific(rl, question, arraySpecificAnswers).then((answer) => {
                    resolve(answer)
                })
            }
        });
    });
}

async function askPattern (rl, question, regExPattern) {
    return new Promise((resolve, reject) => {
        rl.question(`${question}:`, (answer) => {
           
            if(answer && answer.match(regExPattern)) {
                resolve(answer)
            }
            else {
                askPattern(rl, question, regExPattern).then((answer) => {
                    resolve(answer)
                })
            }

        });
    });
}

module.exports.askSpecific = askSpecific
module.exports.askPattern = askPattern