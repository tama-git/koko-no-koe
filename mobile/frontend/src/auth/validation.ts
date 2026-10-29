export type AuthMode = 'login' | 'register';

export type AuthValues = {
  email: string;
  password: string;
  confirmPassword: string;
};

export type AuthErrors = Partial<Record<keyof AuthValues, string>>;

/** 入力画面での確認。サーバー側でも同じ条件を検証する必要がある。 */
export function validateAuth(values: AuthValues, mode: AuthMode): AuthErrors {
  const errors: AuthErrors = {};
  const email = values.email.trim();

  if (!email) {
    errors.email = 'メールアドレスを入力してください。';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'メールアドレスの形式を確認してください。';
  }

  if (!values.password) {
    errors.password = 'パスワードを入力してください。';
  } else if (mode === 'register') {
    const kinds = [
      /[A-Z]/,
      /[a-z]/,
      /[0-9]/,
      /[\x21-\x2F\x3A-\x40\x5B-\x60\x7B-\x7E]/,
    ].filter((pattern) => pattern.test(values.password)).length;

    if ([...values.password].length < 8 || kinds < 3) {
      errors.password = '8文字以上で、英大文字・英小文字・数字・記号のうち3種類以上を使ってください。';
    }
  }

  if (mode === 'register') {
    if (!values.confirmPassword) {
      errors.confirmPassword = '確認用パスワードを入力してください。';
    } else if (values.password !== values.confirmPassword) {
      errors.confirmPassword = 'パスワードが一致しません。';
    }
  }

  return errors;
}
