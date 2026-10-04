# 面接用の説明 / Interview narrative

## 60秒

StateCarryは、保存済みプロジェクトの形式変更を、独立した期待値と保持契約で検証するツールです。移行処理が正常終了しても、移動先にあった利用者の値を上書きしたり、独自フィールドを落としたりすることがあります。そこで「操作が実行できた」「独立した期待値と一致した」「保持したい旧データを説明できた」の3つを別々に表示します。

移行は標準のJSON Patchで記述し、元入力のコピー上で実行します。期待値は実行結果から生成せず、プランを編集しても固定されます。旧項目は、同じパスで等しい、明示した保持関係で等しい、意図した変更・削除、未確認に分け、空配列・空オブジェクトも数えます。検証と同じエンジンを、純粋な移行モジュール・フィクスチャ・Nodeランナーとして出力します。

## 判断とトレードオフ

1. 独自言語よりJSON Patchを選択。6操作を既存の公開テスト群と独立したPython実装で比較できる
2. プランと期待値を分離。壊れた処理の出力で正解を更新する循環を避ける
3. 同じ値が別パスにあるだけでは移動と推測しない。保持関係は作者が明示し、同じパスの一致も「値の観測」と表現する
4. 全葉項目の確認に空コンテナを含める。空の設定領域も利用者の保存状態の一部になり得る
5. 失敗は元入力を変更せず、部分更新した出力を返さない。ただし実アプリの保存トランザクションを提供するわけではない
6. 任意JavaScript・条件分岐・ストレージ接続を外す。表現力と引き換えに、移行のレビュー・再実行・説明を簡潔にする
7. 画面と持ち出したモジュールに同じソースを使う。ただし共通実装の誤りを見逃さないよう、公開コーパスと独立した比較も行う

## デモの見せ方

最初の例では3つのフィクスチャ中2つが一致します。上書きを拒否すべき入力だけ、実際には書き換えられてしまいます。移動前にnullプレースホルダーを確認するtest操作を追加すると、この入力は期待どおりに失敗し、3つとも一致します。2つのプランで元入力・期待値・契約は同一です。これは実行成功率を上げるデモではなく、拒否すべき入力を正しく拒否するデモです。

## English summary

“I built a preservation-first workbench for saved-project migrations. It keeps the migration plan, independent expected fixtures and explicit preservation or change contracts separate. The engine uses standard JSON Patch, runs on a clone and reports overwrite destinations. Original-leaf accounting includes empty containers and does not infer moves from unrelated equal values. I tested standard semantics against a pinned public corpus and Python jsonpatch, then tested contracts with a separate pointer/equality oracle. The exported pure module uses the same engine that was tested in the workbench. This validates specific fixtures and declarations, not universal losslessness or production storage safety.”

## 正直に述べる範囲

合成データのテスト結果と独立比較は実行済みです。初回凍結時のブラウザ・モバイル・印刷のテストは記述済みですが未実行です。実利用者・需要・売上・時間短縮・全データの保持・実アプリ統合を検証したとは言いません。既存の移行ランタイムやJSON変換ツールとの差分は、検証する作業の設計です。
