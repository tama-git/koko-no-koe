"""画面確認専用。実際の利用者・投稿・通報は含まない。"""
REPORTS = (
    {"id": 1, "post_title": "川沿いで見つけた、小さな春", "author": "サンプル利用者A",
     "reason": "個人情報が含まれている可能性", "status": "pending", "status_label": "未確認",
     "body": "川沿いの道を歩いた旅の記録です。これは表示確認用の架空の投稿です。"},
    {"id": 2, "post_title": "夕暮れの駅前を歩く", "author": "サンプル利用者B",
     "reason": "投稿内容についての確認依頼", "status": "pending", "status_label": "未確認",
     "body": "夕暮れの景色を楽しんだ記録です。実際の投稿や位置情報とは関係ありません。"},
    {"id": 3, "post_title": "雨の日の寄り道", "author": "サンプル利用者C",
     "reason": "投稿内容についての確認依頼", "status": "reviewed", "status_label": "確認済み",
     "body": "雨の日の散歩についてのサンプル文章です。内容の保存・更新は行いません。"},
)
