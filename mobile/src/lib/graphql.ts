// mobile/src/lib/graphql.ts
import { gql } from "@apollo/client";

// The operation NAMES (Businesses, Dashboard, ...) are what refetchQueries refers to.

export const BUSINESSES = gql`
  query Businesses {
    businesses {
      id
      name
      slug
      rule { baseSalary bonusType salesPerBonus bonusAmount bonusPctTargetMet bonusPctTargetMissed }
    }
  }
`;

export const MARKETERS = gql`
  query Marketers($businessId: ID) {
    marketers(businessId: $businessId) { id name phone active businesses { id name } }
  }
`;

export const PRODUCTS = gql`
  query Products($businessId: ID) {
    products(businessId: $businessId) { id businessId businessName name price }
  }
`;

export const TRANSACTIONS = gql`
  query Transactions($businessId: ID, $period: String) {
    transactions(businessId: $businessId, period: $period) {
      id businessId businessName marketerId marketerName productId productName amount soldAt note
    }
  }
`;

const STAT_FIELDS = `marketerId marketerName businessId businessName salesCount revenue isPaid paidTotal paidAt`;

export const DASHBOARD = gql`
  query Dashboard($businessId: ID, $period: String!) {
    dashboard(businessId: $businessId, period: $period) {
      period totalSales totalRevenue unpaidCount
      topMarketers { ${STAT_FIELDS} }
    }
  }
`;

export const PAYROLL = gql`
  query Payroll($businessId: ID, $period: String!) {
    payroll(businessId: $businessId, period: $period) { ${STAT_FIELDS} }
  }
`;

const PAYOUT_FIELDS = `marketerId marketerName businessId businessName period salesCount targetAchieved
  baseSalary bonusRaw bonusPct bonusFinal total`;

export const PAYOUT_PREVIEW = gql`
  query PayoutPreview($input: PayInput!) {
    payoutPreview(input: $input) { ${PAYOUT_FIELDS} ruleSummary alreadyPaid }
  }
`;

export const PAYOUTS = gql`
  query Payouts($businessId: ID) {
    payouts(businessId: $businessId) { id ${PAYOUT_FIELDS} paidAt paidBy }
  }
`;

export const CREATE_BUSINESS = gql`
  mutation CreateBusiness($input: BusinessInput!) { createBusiness(input: $input) { id name } }
`;

export const UPDATE_PAY_RULE = gql`
  mutation UpdatePayRule($businessId: ID!, $input: PayRuleInput!) {
    updatePayRule(businessId: $businessId, input: $input) {
      id name rule { baseSalary bonusType salesPerBonus bonusAmount bonusPctTargetMet bonusPctTargetMissed }
    }
  }
`;

export const CREATE_MARKETER = gql`
  mutation CreateMarketer($input: MarketerInput!) { createMarketer(input: $input) { id name } }
`;

export const CREATE_PRODUCT = gql`
  mutation CreateProduct($input: ProductInput!) { createProduct(input: $input) { id name } }
`;

export const CREATE_TRANSACTION = gql`
  mutation CreateTransaction($input: TransactionInput!) { createTransaction(input: $input) { id } }
`;

export const DELETE_TRANSACTION = gql`
  mutation DeleteTransaction($id: ID!) { deleteTransaction(id: $id) }
`;

export const PAY_MARKETER = gql`
  mutation PayMarketer($input: PayInput!) { payMarketer(input: $input) { id total } }
`;

export const ASK_ASSISTANT = gql`
  mutation AskAssistant($input: AskInput!) { askAssistant(input: $input) { text html } }
`;