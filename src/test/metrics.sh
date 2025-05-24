#!/bin/bash

# 临时文件
TEMP_JSON="cc_result.json"
TEMP_CLOC="cloc_result.csv"

# 1. ======================== Summary 汇总 =============================

# 用 CSV 格式统计 .ts 文件的行数
cloc ./src/ --include-lang=TypeScript --by-file --csv --quiet > $TEMP_CLOC

# 计算总行数和文件数
TOTAL_LOC=$(tail -n +3 $TEMP_CLOC | awk -F',' '{sum += $5} END {print sum}')
TOTAL_FILES=$(tail -n +3 $TEMP_CLOC | wc -l | awk '{print $1}')

# 获取依赖数量（只看 production）
DEPS=$(jq '.dependencies | keys | length' package.json)

# 获取 Cyclomatic Complexity JSON
npx cyclomatic-complexity './src/**/*.ts' --json > $TEMP_JSON

# 计算过滤后的总复杂度
TOTAL_CC=$(jq '
  .[] |
  .functionComplexities |
  map(select((.name | test("__|^global$|^verb$|fulfilled|rejected|step|adopt|^anonymous: __|^anonymous: Promise")) | not)) |
  map(.complexity) |
  add // 0
' $TEMP_JSON | jq -s 'add')

# 打印 Summary 报告
echo "================================================"
echo "               STATIC CODE SUMMARY              "
echo "================================================"
printf "• Lines of Code                 : %s\n" "$TOTAL_LOC"
printf "• Number of Source Files        : %s\n" "$TOTAL_FILES"
printf "• Number of Dependencies        : %s\n" "$DEPS"
printf "• Total Cyclomatic Complexity   : %s\n" "$TOTAL_CC"
echo ""

# 2. ======================== 详细信息部分 =============================

# === Part 1: Lines of Code by file ===
echo "------------------------------------------------"
echo "            LINES OF CODE PER FILE             "
echo "------------------------------------------------"
tail -n +3 $TEMP_CLOC | awk -F',' '{ printf "%-60s %s\n", $2, $5 }'

# === Part 2: Dependencies ===
echo ""
echo "------------------------------------------------"
echo "                  DEPENDENCIES                 "
echo "------------------------------------------------"
npm ls --depth=0 2>/dev/null | tail -n +2

# === Part 3: Cyclomatic Complexity (Filtered) ===
echo ""
echo "------------------------------------------------"
echo "      FILTERED CYCLOMATIC COMPLEXITY REPORT     "
echo "------------------------------------------------"
jq -r '
  .[] |
  {
    file: .file,
    functions: (
      .functionComplexities |
      map(select(
        (.name | test("__|^global$|^verb$|fulfilled|rejected|step|adopt|^anonymous:")) | not
      ))
    )
  } |
  select(.functions | length > 0)
' $TEMP_JSON | jq -s '
  group_by(.file) |
  .[] |
  {
    file: .[0].file,
    functions: map(.functions[])
  } |
  "\(.file)\n" +
  (
    .functions |
    sort_by(.line) |
    map("  [line \(.line)] \(.name): \(.complexity)") |
    join("\n")
  )
' -r

# 清理中间产物
rm -f $TEMP_JSON $TEMP_CLOC
