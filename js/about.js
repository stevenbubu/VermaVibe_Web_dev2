
// 錨點平滑捲動（可選）：若未來加 sticky header，可把 offset 改為頂欄高度
(function(){
  var OFFSET = 0; // 若你有固定頂欄，把這裡改成頂欄高度（例如 60）
  function scrollToHash(){
    if(!location.hash) return;
    var el = document.querySelector(location.hash);
    if(!el) return;
    var y = el.getBoundingClientRect().top + window.scrollY - OFFSET;
    window.scrollTo({top:y, behavior:'smooth'});
  }
  window.addEventListener('hashchange', scrollToHash);
  window.addEventListener('load', function(){
    if(!location.hash) {
      // 進頁預設回到 hero（可視需求刪除）
      location.hash = '#hero';
    } else {
      scrollToHash();
    }
  });
})();
