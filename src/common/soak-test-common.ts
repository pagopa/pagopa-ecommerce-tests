import { AmountEuroCents } from "../generated/ecommerce/AmountEuroCents";
import { NewTransactionRequest } from "../generated/ecommerce/NewTransactionRequest";
import { PaymentContextCode } from "../generated/ecommerce/PaymentContextCode";
import { RptId } from "../generated/ecommerce/RptId";
import { getConfigOrThrow } from "../utils/config";

const config = getConfigOrThrow();

function generateRptId() {
    var result = '77777777777' + config.NOTICE_CODE_PREFIX + '01';
    for (var i = 0; i < 12; i++) {
        result = result.concat((Math.floor(Math.random() * 10)).toString());
    }
    return result;
}

export const createActivationRequest = (
    requestRptId: string
): NewTransactionRequest => ({
    email: "mario.rossi@gmail.it",
    paymentNotices: [
        {
            rptId: requestRptId as RptId,
            amount: 1000 as AmountEuroCents,
            paymentContextCode: "6cd9114e-6427-4932-9a27-96168640d944" as PaymentContextCode
        }
    ]
});