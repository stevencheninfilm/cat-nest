const categories = new Map([
  ['主食', {food: 'rice', examples: '暖暖蛋包饭、猫爪三明治'}],
  ['饮品', {food: 'lemontea', examples: '柠檬气泡茶、猫爪拿铁'}],
  ['甜点', {food: 'donut', examples: '草莓甜甜圈、蜂蜜松饼'}],
]);

export function restaurantCommissionEntry(commission) {
  if (!categories.has(commission?.category)) return '';
  const {category, progress, target, completed} = commission;
  return `<button type="button" class="r-commission-entry" data-r-tab="commission">
    <strong>今日委托</strong>
    <span>${category} · ${completed ? '已完成' : `${progress} / ${target} 份`}</span>
    <b aria-hidden="true">›</b>
  </button>`;
}

export function restaurantDailyCommissionMarkup(commission) {
  const dish = categories.get(commission?.category);
  if (!dish) return '';
  const {category, progress, target, completed, rewardCoins} = commission;
  return `<article class="r-commission-card" data-complete="${completed}" aria-labelledby="r-commission-goal">
    <div class="r-commission-goal">
      <span class="r-food r-food-${dish.food}" aria-hidden="true"></span>
      <div>
        <h3 id="r-commission-goal">结账 ${target} 份${category}</h3>
        <p>${dish.examples}等${category}都计入进度。</p>
      </div>
    </div>
    <div class="r-commission-progress">
      <label for="r-commission-progress">已结账 <b>${progress} / ${target} 份</b></label>
      <progress id="r-commission-progress" value="${progress}" max="${target}"></progress>
    </div>
    <div class="r-commission-reward">
      <strong>+${rewardCoins} 小鱼干</strong><span>${completed ? '已到账' : '达成时自动入账'}</span>
    </div>
  </article>
  <p class="r-commission-reset">两位店主共享进度 · 每天北京时间 0 点更新</p>`;
}
