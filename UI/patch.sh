#!/usr/bin/env bash
FILE="src/components/Orders/ExecutedOrders/AddExecutedOrderModal.jsx"


# 1) Сужаем модалку
sed -i 's/size="lg"/size="md"/' "$FILE"

# 2) Добавляем gutter между Row
sed -i 's/<Row>/<Row className="g-2">/g' "$FILE"

# 3) Приводим все Col к нужным размерам
sed -i 's/<Col md={3}>/<Col xs={6} md={3}>/g' "$FILE"
sed -i 's/<Col md={4}>/<Col xs={6} md={3}>/g' "$FILE"
sed -i 's/<Col md={6}>/<Col xs={12} md={6}>/g' "$FILE"

# 4) Минимизируем высоту всех инпутов
sed -i 's/<Form.Control /<Form.Control size="sm" /g' "$FILE"

# 5) Уменьшаем вертикальные отступы у групп
sed -i 's/className="mb-3"/className="mb-2"/g' "$FILE"

echo "Патч Applied ✔️"
