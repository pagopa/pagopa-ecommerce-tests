import { AmountEuroCents } from "../generated/ecommerce-v1/AmountEuroCents";
import { CalculateFeeRequest as GenCalculateFeeRequest } from "../generated/ecommerce-v1/CalculateFeeRequest";
import { NewTransactionRequest } from "../generated/ecommerce-v2/NewTransactionRequest";
import { PaymentContextCode } from "../generated/ecommerce-v1/PaymentContextCode";
import { PaymentNoticeInfo } from "../generated/ecommerce-v1/PaymentNoticeInfo";
import { LanguageEnum, RequestAuthorizationRequest as GenRequestAuthorizationRequest } from "../generated/ecommerce-v1/RequestAuthorizationRequest";
import { RptId } from "../generated/ecommerce-v1/RptId";
import { getConfigOrThrow } from "../utils/config";
import * as t from "io-ts"

type RequestAuthorizationRequest = t.TypeOf<typeof GenRequestAuthorizationRequest>;
type CalculateFeeRequest = t.TypeOf<typeof GenCalculateFeeRequest>;

export enum PaymentMethod {
    CARDS,
    BANCOMATPAY,
    PAYPAL,
    MYBANK,
    REDIRECT_RPIC,
    REDIRECT_RBPS,
    REDIRECT_RBPB,
    REDIRECT_RBPP,
    REDIRECT_RBPR,
}

// These ids are for UAT payment-methods :)
export const paymentMethodIds: Record<PaymentMethod, string> = {
    [PaymentMethod.CARDS]: "378d0b4f-8b69-46b0-8215-07785fe1aad4",
    [PaymentMethod.BANCOMATPAY]: "870d0704-e8af-4e00-a2d1-1af18e144789",
    [PaymentMethod.PAYPAL]: "8991c3f1-4ac4-418c-a359-5aaa9199bbeb",
    [PaymentMethod.MYBANK]: "2c61e6ed-f874-4b30-97ef-bdf89d488ee4",
    [PaymentMethod.REDIRECT_RPIC]: "1c636589-8a81-4478-b725-33fb65d8a2d0",
    [PaymentMethod.REDIRECT_RBPS]: "3a199dbc-f17e-4fd8-9a6f-a677698144a5",
    [PaymentMethod.REDIRECT_RBPB]: "b6fd7e8e-7373-496d-b64f-111766b5ad9c",
    [PaymentMethod.REDIRECT_RBPP]: "79e8e075-9840-4eac-9c4e-8da637d68469",
    [PaymentMethod.REDIRECT_RBPR]: "86fb578f-e3c4-47bc-bce3-85a3171a4b13",
};

const config = getConfigOrThrow();

export function generateRptId() {
    var result = '77777777777' + config.NOTICE_CODE_PREFIX + '01';
    for (var i = 0; i < 12; i++) {
        result = result.concat((Math.floor(Math.random() * 10)).toString());
    }
    return result;
}

function generateOrderId() {
    const length = 18;
    const prefix = "M";
    const alphanums = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._";

    var orderId = prefix;

    while (orderId.length < length) {
        orderId += alphanums.charAt(Math.floor(Math.random() * alphanums.length));
    }

    return orderId;
}

export const createActivationRequest = (
): t.TypeOf<typeof NewTransactionRequest> => ({
    email: "mario.rossi@gmail.it",
    paymentNotices: Array(5).fill("").map(paymentNotice),
    orderId: generateOrderId()
});

export const paymentNotice = (): PaymentNoticeInfo => ({
    rptId: generateRptId() as RptId,
    amount: 1000 as AmountEuroCents,
    paymentContextCode: "6cd9114e-6427-4932-9a27-96168640d944" as PaymentContextCode
})

export const createFeeRequest = (): CalculateFeeRequest => {
    return {
        bin: "52550002",
        touchpoint: "CHECKOUT",
        paymentAmount: 12000,
        primaryCreditorInstitution: "77777777777",
        transferList: [
          {
            creditorInstitution: "77777777777",
            digitalStamp: false,
            transferCategory: "0101101IM"
          },
          {
            creditorInstitution: "01199250158",
            digitalStamp: false,
            transferCategory: "0201102IM"
          }
        ],
        isAllCCP: false
    };
}

export const createAuthorizationRequest = (
    method: PaymentMethod
) => {
    const functionMap: Record<PaymentMethod, () => RequestAuthorizationRequest> = {
        [PaymentMethod.CARDS]: createAuthorizationRequestCards,
        [PaymentMethod.BANCOMATPAY]: () => createAuthorizationRequestAPM(PaymentMethod.BANCOMATPAY),
        [PaymentMethod.PAYPAL]: () => createAuthorizationRequestAPM(PaymentMethod.PAYPAL),
        [PaymentMethod.MYBANK]: () => createAuthorizationRequestAPM(PaymentMethod.MYBANK),
        [PaymentMethod.REDIRECT_RPIC]: () => createAuthorizationRequestRedirect(PaymentMethod.REDIRECT_RPIC),
        [PaymentMethod.REDIRECT_RBPS]: () => createAuthorizationRequestRedirect(PaymentMethod.REDIRECT_RBPS),
        [PaymentMethod.REDIRECT_RBPB]: () => createAuthorizationRequestRedirect(PaymentMethod.REDIRECT_RBPB),
        [PaymentMethod.REDIRECT_RBPP]: () => createAuthorizationRequestRedirect(PaymentMethod.REDIRECT_RBPP),
        [PaymentMethod.REDIRECT_RBPR]: () => createAuthorizationRequestRedirect(PaymentMethod.REDIRECT_RBPR),
    };

    return functionMap[method]();
}

export const createAuthorizationRequestCards = (): RequestAuthorizationRequest => ({
    amount: 100 as AmountEuroCents,
    fee: 0 as AmountEuroCents,
    pspId: "PSP_ILA",
    language: LanguageEnum.IT,
    paymentInstrumentId: paymentMethodIds[PaymentMethod.CARDS],
    details: {
        detailType: "cards",
        orderId: generateOrderId()
    },
    isAllCCP: false
});

export const createAuthorizationRequestAPM = (method: PaymentMethod): RequestAuthorizationRequest => ({
    amount: 100 as AmountEuroCents,
    fee: 0 as AmountEuroCents,
    pspId: "PSP_ILA",
    language: LanguageEnum.IT,
    paymentInstrumentId: paymentMethodIds[method],
    details: {
        detailType: "apm",
    },
    isAllCCP: false
});

export const createAuthorizationRequestRedirect = (method: PaymentMethod): RequestAuthorizationRequest => ({
    amount: 100 as AmountEuroCents,
    fee: 0 as AmountEuroCents,
    pspId: "PSP_ILA",
    language: LanguageEnum.IT,
    paymentInstrumentId: paymentMethodIds[method],
    details: {
        detailType: "redirect",
    },
    isAllCCP: false
});
