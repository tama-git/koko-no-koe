/** 投稿の取得・登録・削除を実装する場所。送受信の形式はサーバー担当と確認する。 */

// 環境変数からベースURLを取得
const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, '') ?? '';
function getApiUrl(): string {
  // フォームを読み込むだけでは例外を出さず、実際の通信時に設定を確認する。
  if (!baseUrl || !/^https?:\/\//i.test(baseUrl)) {
    throw new Error('接続先が設定されていません。開発者に確認してください。');
  }
  return `${baseUrl}/api/posts/`;
}

/**
 * 投稿一覧を取得する関数 GET
 */
export async function loadPosts(): Promise<any> {
  try {
    // APIサーバーへGETリクエスト
    const response = await fetch(getApiUrl());

    // レスポンスが正常でなければエラーを投げる
    if (!response.ok) {
      throw new Error(`データの取得に失敗しました: ${response.status}`);
    }

    // レスポンスをJSON形式に変換
    const posts = await response.json();
    return posts;
  } catch (error) {
    console.error('投稿一覧の取得に失敗しました:', error);
    throw error;
  }
}

/**
 * 新しい投稿を登録する関数 POST
 */
export async function createPost(postData: {
  message?: string;
  latitude: number;
  longitude: number;
  image?: any;
  is_published: boolean;
}): Promise<any> {
  try {
    // メッセージと画像が両方入っていない場合は送信ストップ
    if (!postData.message && !postData.image) {
      throw new Error('メッセージまたは画像のどちらかを入力してください。');
    }

    // フォームデータの入れ物を作成
    const formData = new FormData();

    // 必須項目の追加（データベースが NOT NULL の前提）
    formData.append('latitude', postData.latitude.toString());          // 緯度
    formData.append('longitude', postData.longitude.toString());        // 経度
    formData.append('is_published', postData.is_published.toString());  // 公開ステータス

    // 任意項目の追加（値が存在する場合のみ）
    if (postData.message) {
      formData.append('message', postData.message);   // メッセージ
    }
    if (postData.image) {
      formData.append('image', postData.image);   // 画像
    }

    // APIサーバーへPOSTリクエスト
    const response = await fetch(getApiUrl(), {
      method: 'POST',
      body: formData,
    });

    // レスポンスが正常でなければエラーを投げる
    if (!response.ok) {
      throw new Error(`投稿の作成に失敗しました: ${response.status}`);
    }

    // レスポンスをJSON形式に変換して返す
    const createdPost = await response.json();
    return createdPost;

  } catch (error) {
    console.error('投稿の登録に失敗しました:', error);
    throw error;
  }
}

/**
 * 指定したIDの投稿詳細を取得する関数
 */
export async function getPostById(postId: number) {
  const response = await fetch(`https://your-backend-url/api/posts/${postId}/`);
  
  if (!response.ok) {
    throw new Error('投稿詳細の取得に失敗しました');
  }
  
  return await response.json();
}
