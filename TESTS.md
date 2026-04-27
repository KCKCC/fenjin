# 測試說明

## 自動化測試

### 純函數單元測試 (`src/utils/transform.test.ts`)

測試了所有變換相關的純函數，涵蓋三個用戶提到的問題：

```bash
npx vitest run src/utils/transform.test.ts
```

#### 測試案例對應

| 用戶反饋問題 | 對應測試 |
|---|---|
| ① 滑鼠放開後復原 | `🔥 問題 1` 區段 (3 個 case) |
| ② 控制框位置偏差 | `🔥 問題 2` 區段 (2 個 case) + 整合測試 |
| ③ Ctrl+V 貼上失效 | `App.tsx` 改用 document-level paste |

關鍵測試摘要：
- `move 拖曳結果應該是「起始 + 位移」` 確保 mouseup 後不會跳回原位
- `多次 move 拖曳，每次都基於 startTransform 而非累積` 確保拖曳穩定性
- `圖層左上角應該與圖片實際左上角重合` 確保座標系統一致
- `當畫布縮放 2x 時...` 驗證縮放下控制框位置正確

### 型別/編譯測試

```bash
npm run build
```
透過 TypeScript 嚴格模式 + Vite 打包確保所有元件型別一致。

---

## 手動測試清單

### Test 1: 滑鼠放開不復原 (問題 ①)
1. 上傳一張圖片
2. 按 `Ctrl/Cmd + V` 從剪貼簿貼上另一張圖（或拖入一張新圖）→ 建立第二個圖層
3. 按 `T` 切換到變換工具
4. 在右側圖層面板選擇剛貼上的「繪圖」圖層
5. 拖曳藍色虛線框移動圖層
6. **放開滑鼠後，圖層應該停在新位置**（不再跳回原處）✅

### Test 2: 控制框對齊 (問題 ②)
1. 上傳圖片並貼上一張新圖層（或新增空白圖層後在上面畫東西）
2. 按 `T` 切換到變換工具，選擇該圖層
3. **藍色虛線框應該完全包覆圖層內容**，左上角對齊圖片左上角 ✅
4. 用滾輪縮放畫布、用滑鼠右鍵拖曳平移 → 控制框會跟著正確移動 ✅

### Test 3: 剪貼簿貼上 (問題 ③)
1. 上傳一張基底圖片
2. 從另一個程式（截圖工具、瀏覽器右鍵複製圖片、Photoshop 等）複製一張圖
3. 在本網頁中按 `Ctrl/Cmd + V`（**不需要先點擊網頁**，document-level 監聽）
4. **應該立即建立一個新的圖層**，包含剛剛複製的圖 ✅

### Test 4: 拖入圖片成新圖層
1. 開啟系統檔案總管/Finder
2. 將一張圖片拖入網頁
3. 出現藍色「📥 放開以加入新圖層」全螢幕提示
4. 放開 → 建立新圖層 ✅

### Test 5: 變換後仍可繪圖/液化
1. 在新圖層上畫一些東西
2. 按 T，旋轉 30 度，縮放 1.5 倍
3. 切回畫筆 (B)
4. 在該圖層上繼續畫 → 筆觸應該對齊變換後的圖層位置（座標已換算）

---

## 實作要點

### 為何「滑鼠放開復原」會發生？
原因是 `onCommit({ ...transform })` 中的 `transform` 是 React props 的「render 時值」，不是拖曳過程中累積的最新值。

修正：用 `dragRef.current.latestTransform` 儲存拖曳中的最新值，mouseup 時讀取它。

### 為何控制框會偏移？
顯示畫布的 CSS：
```css
position: absolute;
left: 50%; top: 50%;
transform: translate(-50%, -50%) translate(offset.x, offset.y) scale(zoom);
```
這代表畫布**中心**對齊容器中心，不是左上角。所以 canvas → screen 轉換必須是：
```ts
screenX = containerCenterX + (canvasX - canvasWidth/2) * zoom
```

### 為何 `Ctrl+V` 在 keydown 中不可靠？
1. `<div tabIndex={0}>` 只有在點擊後才有焦點才能觸發 keydown
2. `navigator.clipboard.read()` 需要 secure context 與用戶授權，且部分瀏覽器禁用

修正：改用 document-level `paste` 事件監聽，瀏覽器會自動解析剪貼簿並提供 `clipboardData.items`，無需特殊權限或焦點。
