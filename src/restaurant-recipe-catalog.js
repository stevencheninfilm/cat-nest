import { restaurantResourceLevel } from './restaurant-progression.js';
import { specialRestaurantRecipe } from './restaurant-economy.js';

export const RESTAURANT_RECIPES = Object.freeze([
  { id:'rice', name:'暖暖蛋包饭', category:'主食', price:24, xp:6, seconds:8, icon:'rice' },
  { id:'coffee', name:'猫爪拿铁', category:'饮品', price:32, xp:7, seconds:11, icon:'coffee' },
  { id:'pancake', name:'蜂蜜松饼', category:'甜点', price:46, xp:9, seconds:14, icon:'pancake' },
  { id:'burger', name:'芝士汉堡', category:'主食', price:62, xp:12, seconds:18, icon:'burger' },
  { id:'parfait', name:'莓莓圣代', category:'甜点', price:110, xp:19, seconds:28, icon:'parfait' },
  { id:'sandwich', name:'猫爪三明治', category:'主食', price:28, xp:6, seconds:9, icon:'sandwich' },
  { id:'lemontea', name:'柠檬气泡茶', category:'饮品', price:26, xp:6, seconds:9, icon:'lemontea' },
  { id:'donut', name:'草莓甜甜圈', category:'甜点', price:30, xp:7, seconds:10, icon:'donut' },
  { id:'pudding', name:'焦糖布丁', category:'甜点', price:42, xp:8, seconds:13, icon:'pudding' },
  { id:'matcha', name:'抹茶奶盖', category:'饮品', price:44, xp:9, seconds:14, icon:'matcha' },
  { id:'udon', name:'鲜虾乌冬', category:'主食', price:66, xp:12, seconds:19, icon:'udon' },
  { id:'waffle', name:'莓果华夫饼', category:'甜点', price:64, xp:12, seconds:18, icon:'waffle' },
  { id:'strawberrymilk', name:'草莓牛奶', category:'饮品', price:58, xp:11, seconds:17, icon:'strawberrymilk' },
  { id:'grape', name:'葡萄啵啵', category:'饮品', price:78, xp:14, seconds:21, icon:'grape' },
  { id:'cheesecake', name:'巴斯克芝士蛋糕', category:'甜点', price:108, xp:18, seconds:27, icon:'cheesecake' },
  { id:'cocoa', name:'棉花糖可可', category:'饮品', price:104, xp:18, seconds:26, icon:'cocoa' },
].map(recipe=>Object.freeze({...recipe,unlockLevel:restaurantResourceLevel('recipe',recipe.id)})));

export const restaurantRecipe = id=>RESTAURANT_RECIPES.find(recipe=>recipe.id===id)||specialRestaurantRecipe(id);
