import { AmountEuroCents } from "../generated/ecommerce/AmountEuroCents";
import { CalculateFeeRequest } from "../generated/ecommerce/CalculateFeeRequest";
import { NewTransactionRequest } from "../generated/ecommerce/NewTransactionRequest";
import { PaymentContextCode } from "../generated/ecommerce/PaymentContextCode";
import { BrandEnum } from "../generated/ecommerce/PaymentInstrumentDetail";
import { PaymentNoticeInfo } from "../generated/ecommerce/PaymentNoticeInfo";
import { LanguageEnum, RequestAuthorizationRequest } from "../generated/ecommerce/RequestAuthorizationRequest";
import { RptId } from "../generated/ecommerce/RptId";
import { getConfigOrThrow } from "../utils/config";

const config = getConfigOrThrow();

export function generateRptId() {
    var result = '77777777777' + config.NOTICE_CODE_PREFIX + '01';
    for (var i = 0; i < 12; i++) {
        result = result.concat((Math.floor(Math.random() * 10)).toString());
    }
    return result;
}

export const createActivationRequest = (
): NewTransactionRequest => ({
    email: "mario.rossi@gmail.it",
    paymentNotices: Array(5).fill("").map(paymentNotice)
});

export const paymentNotice = ()
    : PaymentNoticeInfo => ({
        rptId: generateRptId() as RptId,
        amount: 1000 as AmountEuroCents,
        paymentContextCode: "6cd9114e-6427-4932-9a27-96168640d944" as PaymentContextCode
    })

export const createAuthorizationRequest = (
): RequestAuthorizationRequest => ({
    amount: 100 as AmountEuroCents,
    fee: 0 as AmountEuroCents,
    pspId: "PSP_ILA",
    language: LanguageEnum.IT,
    paymentInstrumentId: "79e01170-5af9-4d4a-9a3b-c9cbca3af60e",
    isAllCCP: true,
    details: {
        brand: BrandEnum.VISA,
        cvv: "123",
        detailType: "card",
        expiryDate: "203012",
        holderName: "M C",
        pan: "4000000000000101",
        threeDsData: "{\"browserJavaEnabled\":\"false\",\"browserLanguage\":\"it-IT\",\"browserColorDepth\":\"24\",\"browserScreenHeight\":\"1440\",\"browserScreenWidth\":\"3440\",\"browserTZ\":\"-60\",\"browserAcceptHeader\":\"*/*\",\"browserIP\":\"93.67.147.246\",\"browserUserAgent\":\"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36\",\"acctID\":\"ACCT_9e3d49d3-f337-4bdc-97e2-031cd5ae01d8\",\"deliveryEmailAddress\":\"mario.rossi@email.com\",\"mobilePhone\":null}"
    }
});

export const calculateFeeRequest = (
): CalculateFeeRequest => ({
    touchpoint: "CHECKOUT",
    bin: "511111",
    paymentAmount: 100,
    primaryCreditorInstitution: "77777777777",
    transferList: [{
        creditorInstitution: "77777777777",
        digitalStamp: false,
    }],
    isAllCCP: true,
});