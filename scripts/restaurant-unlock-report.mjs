import { writeFile } from 'node:fs/promises';
import { initialRestaurant, restaurantInfo } from '../src/restaurant.js';
import { restaurantLevelInfo as levelInfo } from '../src/growth-levels.js';
import { RESTAURANT_GROWTH_STAGES } from '../src/restaurant-growth-stages.js';
import { RESTAURANT_FACILITIES } from '../src/restaurant-facilities.js';
import { facilityEffectCopy, staffEffectCopy } from '../src/restaurant-upgrade-ui.js';
import { STAFF_TRAINING_STATS } from '../src/restaurant-staff-training.js';
import { restaurantResourceLevel } from '../src/restaurant-progression.js';

const {progression}=restaurantInfo({restaurant:initialRestaurant(0)},0);
const categories={recipe:'菜谱',staff:'员工',facility:'设施',research:'研发',training:'员工训练',decoration:'装扮',station:'厨房工位'};
const price=item=>item.cost===0?'免费':item.cost===null?'按项目分别付费':`${item.cost} ${item.currency==='goldFish'?'金鱼干':'小鱼干'}`;
const rows=progression.milestones.map(m=>`| Lv.${m.level} | ${m.startExperience} | ${levelInfo(m.startExperience).target} | ${m.items.map(item=>`${item.name}（${categories[item.kind]}；${price(item)}）`).join('<br>')} |`).join('\n');
const stageRows=RESTAURANT_GROWTH_STAGES.map(stage=>`| Lv.${stage.min}–${stage.max} | ${stage.title} | ${'★'.repeat(stage.stars)} | ${stage.color} |`).join('\n');
const facilityRows=RESTAURANT_FACILITIES.map(item=>{const effect=facilityEffectCopy(item.id,10);return `| ${item.name} | ${effect.primary}${effect.secondary?` · ${effect.secondary}`:''} | 小馆 Lv.${restaurantResourceLevel('facility',item.id,10)} |`;}).join('\n');
const abilityRows=Array.from({length:10},(_,i)=>`| Lv.${i+1} | ${STAFF_TRAINING_STATS.map(stat=>{const effect=staffEffectCopy(stat.id,i+1);return `${effect.primary}<br>${effect.secondary}`;}).join(' | ')} |`).join('\n');
const source=`# 餐厅等级与资源开放路线

本文件由当前实际目录生成。运行 \`node scripts/restaurant-unlock-report.mjs\` 可在新增菜谱、员工或装扮后重新生成；共 ${progression.catalog.length} 个开放节点，每个节点在路线中恰好出现一次。

## 经验阶梯

餐厅独立累计结账获得的营业经验，来源为 \`restaurant.stats.experience\`。同一笔实际结账经验按 1:1 生成小窝的「餐厅经营经验」气泡，回小窝点击领取后才计入主猫猫 \`state.xp\`。购买、研发、训练、施工和升级设施不会增加经验，重试同一结账不会重复发放。

餐厅采用 \`src/growth-levels.js\` 的营业经验阶梯：首次升级需 60 经验，此后每级增加 15，即 60、75、90、105……；达到 L 级的累计门槛为 \`7.5 × (L−1) × (L+6)\`。当前资源分布在 1–50 级，每一级都有现有资源开放；50 级之后仍继续积累等级，不改变主猫猫的升级阶梯。达到 50 级累计需 20,580 经验。主猫猫仍采用 120 起、每级增加 30 的原阶梯。

等级只开放购买、研发或训练的资格，不自动赠送需要付费的内容；菜谱、员工、设施、装扮仍支付原价格。员工按招聘顺序加入，设施与能力逐级提升。员工四项能力与四类设施各自最高 10 级；菜品品质为 B、A、S、SS、SSS 五档。

## 餐厅称号与星级

| 等级 | 称号 | 星级 | 经验主色 |
|---|---|---|---|
${stageRows}

称号、星星和经验条每十级一起焕新，顶部常驻等级卡、营业经验动画、成长路线当前信息及阶段标题共用同一份阶段配置。跨越阶段时先填满旧颜色，再切换新阶段；51 级起继续沿用全球旗舰店与五星外观。这里的星级为游戏成长标记，不影响菜单研发星级或实际经验计算。

## 当前资源

- 21 道菜谱：18 道普通料理和 3 道金色招牌。
- 7 位员工：基础橘子主厨和 6 位可雇佣伙伴。
- 4 类设施，每类最高 10 级，共 40 个设施节点。
- 9 套装扮：6 套完整场景及 3 套金鱼干珍藏装扮；原三个基础色系由对应场景覆盖，不重复算成额外装扮。
- 速度、体力、耐力、熟练度四项员工能力；每人每项独立付费和升级。
- 10 个独立厨房工位，开业即开放。

研发与训练节点表示可升至该等级的上限，费用是每道菜或每位员工每项分别支付；已解锁菜谱仍须在菜谱中分别研发。

## 设施满级效果

| 设施 | Lv.10 最终能力 | 开放门槛 |
|---|---|---|
${facilityRows}

料理台和冰箱沿用原 Lv.1–4 的时间倍率 1、0.85、0.7、0.55；Lv.5–10 依次为 0.5、0.45、0.4、0.35、0.3、0.25。员工、装扮倍率与最短操作时间继续生效。用餐座位 Lv.1–4 保留 2、4、6、8 桌，Lv.5–10 每级增加 5% 舒适收益，保持现有八桌场景和路线。暖心服务每级增加 15% 小鱼干收入，满级 +135%；舒适收益与暖心服务乘算。原 Lv.1–4 价格与开放门槛不变。

新订单锁定接单时的设施等级；原订单不因之后升级重新计价或更改已开始工序的时间。已有存档保留原设施级别，不重置余额或订单。

## 员工逐级增益

以下均为相对 Lv.1 的累计百分比；速度提升与耗时减少分别显示，实际加工仍受最短时间限制。

| 等级 | 速度 | 体力 | 耐力 | 熟练度 |
|---|---|---|---|---|
${abilityRows}

每道新工序基础消耗 10 点体力，耐力按系数折扣后向上取整，故相邻等级可能实际消耗相同。熟练度售价加成与其他收入倍率叠加后取整，不提高经验或金鱼干奖励。每张升级卡常驻当前、下一级和满级效果，展开可查全部十级的门槛、价格和累计增益。

## 逐级开放

| 餐厅等级 | 到达等级的累计经验 | 升至下一级所需经验 | 本级开放的现有资源 |
|---|---:|---:|---|
${rows}

## 旧存档与权威验证

新餐厅保存 \`progression = {version:2, experienceOffset:0, legacyRecipes:[]}\`。旧餐厅缺少此字段时，按旧的每六单升级、最高 5 级规则识别已达到的等级；必要时用一次性的营业经验折算量补齐到该等级门槛。折算量存放在 \`experienceOffset\`，不会改变真实营业经验、主猫猫经验或任何货币，重复读档和保存也不会叠加。

从旧的十级路线迁移时，按迁移当时的营业等级，一次性记录原五级菜谱规则已开放的普通菜到 \`legacyRecipes\`；已研发或已接单的普通菜也保留。该清单固定保存，不会随以后等级增长套用旧规则继续追加，已购买的金色招牌可继续供应。现有营业经验和旧折算量保持数值不变，餐厅等级按新的半价阶梯计算；旧迁移折算量仍按原上限验证，避免已有存档被误判无效。

已经雇佣的员工、已有高阶设施、已训练的能力、研发星级和已拥有装扮不会被收回。以后购买或升级新内容时检查新的餐厅等级要求；已拥有的装扮可继续切换。已接订单仍保持原时间线、价格和能力快照。

等级与每项资格由同一份共用 reducer 和服务端计算；客户端不能提交等级、经验、折算量、价格或已解锁标记。界面中的锁定提示和成长路线均读取同一目录与要求。

## 入口与实现

点击餐厅顶部的小馆等级，或“升级”面板中的“小馆成长路线”，查看按等级排列、按类别筛选的完整路线。手机版每 10 级归为一个可折叠阶段，默认展开全部阶段与等级，可点击标题折叠；路线区分已拥有、可购买与未到级，并展示下一等级和本级经验进度。

营业页右上角常驻短经验条；实际结账增加营业经验时，钱包下方短暂显示本次经验与进度动画，跨级先填满旧等级再显示新等级，随后自动收起。重复同步和重新进入页面不会重播旧奖励。

核心规则位于 \`src/restaurant-progression.js\`；目录由实际菜谱、员工、设施、装扮和厨房工位组合生成。追加资源时沿用原目录并在 \`RESTAURANT_UNLOCK_LEVELS\` 配置开放等级，无需复制页面或新建存档。
`;
await writeFile(new URL('../docs/restaurant-progression.md',import.meta.url),source);
console.log(`Restaurant roadmap generated: ${progression.catalog.length} resources, ${progression.milestones.length} milestones.`);
