import { AmountEuroCents } from "../generated/ecommerce-v1/AmountEuroCents";
import { Bundle } from "../generated/ecommerce-v2/Bundle";
import { CalculateFeeRequest as GenCalculateFeeRequest } from "../generated/ecommerce-v1/CalculateFeeRequest";
import { CalculateFeeRequest as GenCalculateFeeRequestV2 } from "../generated/ecommerce-v2/CalculateFeeRequest";
import { NewTransactionRequest } from "../generated/ecommerce-v2/NewTransactionRequest";
import { PaymentContextCode } from "../generated/ecommerce-v1/PaymentContextCode";
import { PaymentNoticeInfo } from "../generated/ecommerce-v1/PaymentNoticeInfo";
import { LanguageEnum, RequestAuthorizationRequest as GenRequestAuthorizationRequest } from "../generated/ecommerce-v1/RequestAuthorizationRequest";
import { RptId } from "../generated/ecommerce-v1/RptId";
import { getConfigOrThrow } from "../utils/config";
import * as t from "io-ts"

type RequestAuthorizationRequest = t.TypeOf<typeof GenRequestAuthorizationRequest>;
type CalculateFeeRequest = t.TypeOf<typeof GenCalculateFeeRequest>;
type CalculateFeeRequestV2 = t.TypeOf<typeof GenCalculateFeeRequestV2>;

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

export const pspsIds: Record<PaymentMethod, string> = {
    [PaymentMethod.CARDS]: "BCITITMM",
    [PaymentMethod.BANCOMATPAY]: "BCITITMM",
    [PaymentMethod.PAYPAL]: "BCITITMM",
    [PaymentMethod.MYBANK]: "BCITITMM",
    [PaymentMethod.REDIRECT_RPIC]: "BCITITMM",
    [PaymentMethod.REDIRECT_RBPS]: "POSOIT22XXX",
    [PaymentMethod.REDIRECT_RBPB]: "PPAYITR1XXX",
    [PaymentMethod.REDIRECT_RBPP]: "PPAYITR1XXX",
    [PaymentMethod.REDIRECT_RBPR]: "PPAYITR1XXX",
};

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
    var result = '00000000000' + config.NOTICE_CODE_PREFIX + '01';
    for (var i = 0; i < 12; i++) {
        result = result.concat((Math.floor(Math.random() * 10)).toString());
    }
    return result;
}

export function generateOrderId() {
    const length = 18;
    const prefix = "M";
    const alphanums = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._";

    var orderId = prefix;

    while (orderId.length < length) {
        orderId += alphanums.charAt(Math.floor(Math.random() * alphanums.length));
    }

    return orderId;
}

export const createActivationRequest = (orderId: string): t.TypeOf<typeof NewTransactionRequest> => ({
    email: "mario.rossi@gmail.it",
    paymentNotices: Array(5).fill("").map(paymentNotice),
    orderId: orderId
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

export const createFeeRequestV2 = (): CalculateFeeRequestV2 => {
    return {
        bin: "52550002",
        touchpoint: "CHECKOUT",
        paymentNotices: [
            {
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
                ]
            }
        ],
        isAllCCP: false
    };
}

type CreateAuthorizationRequest = (orderId: string, isAllCCP: boolean, amount:AmountEuroCents, bundle: Bundle) => RequestAuthorizationRequest

export const createAuthorizationRequest = (
    orderId: string,
    isAllCCP: boolean,
    amount: AmountEuroCents,
    bundle: Bundle,
    method: PaymentMethod
) => {
    const functionMap: Record<PaymentMethod, CreateAuthorizationRequest> = {
        [PaymentMethod.CARDS]: createAuthorizationRequestCards(),
        [PaymentMethod.BANCOMATPAY]: createAuthorizationRequestAPM(PaymentMethod.BANCOMATPAY),
        [PaymentMethod.PAYPAL]: createAuthorizationRequestAPM(PaymentMethod.PAYPAL),
        [PaymentMethod.MYBANK]: createAuthorizationRequestAPM(PaymentMethod.MYBANK),
        [PaymentMethod.REDIRECT_RPIC]: createAuthorizationRequestRedirect(PaymentMethod.REDIRECT_RPIC),
        [PaymentMethod.REDIRECT_RBPS]: createAuthorizationRequestRedirect(PaymentMethod.REDIRECT_RBPS),
        [PaymentMethod.REDIRECT_RBPB]: createAuthorizationRequestRedirect(PaymentMethod.REDIRECT_RBPB),
        [PaymentMethod.REDIRECT_RBPP]: createAuthorizationRequestRedirect(PaymentMethod.REDIRECT_RBPP),
        [PaymentMethod.REDIRECT_RBPR]: createAuthorizationRequestRedirect(PaymentMethod.REDIRECT_RBPR),
    };

    return functionMap[method](orderId, isAllCCP, amount, bundle);
}

export const createAuthorizationRequestCards = (): CreateAuthorizationRequest => (orderId, isAllCCP, amount, bundle) => ({
    amount: amount,
    fee: bundle.taxPayerFee as AmountEuroCents,
    pspId: bundle.idPsp!,
    language: LanguageEnum.IT,
    paymentInstrumentId: paymentMethodIds[PaymentMethod.CARDS],
    details: {
        detailType: "cards",
        orderId: orderId
    },
    isAllCCP: isAllCCP
});

export const createAuthorizationRequestAPM = (method: PaymentMethod): CreateAuthorizationRequest => (_, isAllCCP, amount, bundle) => ({
    amount: amount,
    fee: bundle.taxPayerFee as AmountEuroCents,
    pspId: bundle.idPsp!,
    language: LanguageEnum.IT,
    paymentInstrumentId: paymentMethodIds[method],
    details: {
        detailType: "apm",
    },
    isAllCCP: isAllCCP
});

export const createAuthorizationRequestRedirect = (method: PaymentMethod): CreateAuthorizationRequest => (_, isAllCCP, amount, bundle) => ({
    amount: amount,
    fee: bundle.taxPayerFee as AmountEuroCents,
    pspId: bundle.idPsp!,
    language: LanguageEnum.IT,
    paymentInstrumentId: paymentMethodIds[method],
    details: {
        detailType: "redirect",
    },
    isAllCCP: isAllCCP
});

export const randomPaymentMethod = (): PaymentMethod => {
    const values = Object.values(PaymentMethod);
    const randomIndex = Math.floor(Math.random() * values.length);
    return randomIndex as PaymentMethod;
}