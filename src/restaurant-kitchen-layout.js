/** Countertop coordinates measured on the 940×1672 reference scene.
 * The 4/5 divider is the seam between the two ovens (x=48.6%).
 * Props use their own surface anchor instead of filling cabinet hit areas. */
const zone=(id,name,bounds,work,prop)=>Object.freeze({id,name,bounds:Object.freeze(bounds),work:Object.freeze(work),prop:Object.freeze(prop)});
export const INTERACTIVE_KITCHEN_ZONES=Object.freeze([
  zone(1,'饮品与冰激凌',{x:10,y:67,w:11,h:9},{x:25,y:72},{x:16.2,y:72,width:8.5}),
  zone(2,'饮品打包',{x:10,y:76,w:11,h:8.5},{x:25,y:79.5},{x:16.2,y:80,width:8.5}),
  zone(3,'装盘与其他操作',{x:21.3,y:84.6,w:16.4,h:5.3},{x:30,y:83.9},{x:29.5,y:87,width:8}),
  zone(4,'炖煮台',{x:37.7,y:84.6,w:10.9,h:5.3},{x:43,y:83.9},{x:43,y:87,width:8}),
  zone(5,'炒菜台',{x:48.6,y:84.6,w:9.9,h:5.3},{x:53.5,y:83.9},{x:53.5,y:86.8,width:10}),
  zone(6,'切菜台',{x:58.5,y:84.6,w:18.5,h:5.3},{x:67.5,y:83.9},{x:67.5,y:87,width:12.5}),
  zone(7,'洗菜池',{x:77,y:84.6,w:15,h:5.3},{x:83,y:83.9},{x:84.2,y:86.7,width:10.5}),
  zone(8,'备菜台',{x:84.5,y:76,w:7.5,h:8.5},{x:80,y:79},{x:88.5,y:80,width:6.5}),
  zone(9,'调料台',{x:84.5,y:68,w:7.5,h:8},{x:80,y:72},{x:89,y:72.5,width:5}),
  zone(10,'冰箱',{x:77,y:61,w:14,h:8},{x:75,y:71},{x:84,y:65,width:14}),
]);
