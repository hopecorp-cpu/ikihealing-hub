const boDau = (s: string) =>
  (s || "").replace(/Đ/g, "D").replace(/đ/g, "d").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const LUAT_SP = [
  ["san-pham-b", /(khong |khong co )?caffeine|buoi toi|truoc khi ngu|mat ngu|kho ngu|giac ngu|thu gian|san pham b|hoa nhai/],
  ["san-pham-c", /\btra\b|thao moc|tui loc|san pham c|nuoc uong|thuc uong/],
  ["san-pham-a-protein", /\bdam\b|protein|thuan chay|an chay|whey|co bap|van dong|bua sang|bua phu|dinh duong|hat va dau|nang luong/],
];

export function chonSlugSanPham(p: { title?: string; description?: string; slug?: string; categoryKey?: string }): string {
  const chu = boDau([p.title, p.description, p.categoryKey, p.slug].filter(Boolean).join(" "));
  for (const [slug, re] of LUAT_SP) if ((re as RegExp).test(chu)) return slug as string;
  return "san-pham-a-protein";
}

export const SP_POPUP: Record<string, { ten: string; loai: string }> = {
  "san-pham-a-protein": { ten: "Đạm Mẫu Protein Pro", loai: "Bột đạm thực vật · hộp 22 gói" },
  "san-pham-c": { ten: "Trà Mẫu A", loai: "Trà thảo mộc túi lọc · hộp 30 gói" },
  "san-pham-b": { ten: "Trà Mẫu B", loai: "Trà thảo mộc bốn vị · túi lọc" },
};

export const EXIT_POPUP_MAU = `<div id="novaExit" role="dialog" aria-modal="true" aria-label="Nhận ebook 100 Bữa Ăn Đủ Đạm miễn phí" hidden>
  <div class="ie-card">
    <button class="ie-x" type="button" aria-label="Đóng">&times;</button>
    <svg class="ie-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z"></path><path d="M20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z"></path></svg>
    <span class="ie-tag">Ebook miễn phí</span>
    <h3>Khoan đã — nhận ebook<br>100 Bữa Ăn Đủ Đạm Không Cần Thịt</h3>
    <p>100 món Việt dễ nấu, mỗi món kèm <strong>lượng đạm ước tính</strong> cho từng khẩu phần. Nhận link tải ngay, bản PDF gửi thêm vào email. Không cần mua gì.</p>
    <form class="ie-form" novalidate>
      <input type="email" class="ie-email" placeholder="Email của bạn..." aria-label="Email" required autocomplete="email" />
      <input type="tel" class="ie-sdt" placeholder="Số Zalo (không bắt buộc) — để nhận thêm thực đơn 3 ngày" aria-label="Số Zalo" autocomplete="tel" />
      <input type="text" class="ie-honey" tabindex="-1" autocomplete="off" aria-hidden="true" />
      <label class="ie-dy"><input type="checkbox" class="ie-dy-cb" id="dyTin" /><span>Nhận thêm bài viết và ưu đãi từ NOVA (có thể ngừng bất cứ lúc nào)</span></label>
      <button type="submit" class="ie-btn">Nhận ebook miễn phí &rarr;</button>
    </form>
    <p class="ie-ok" role="status" hidden>&#10003; Xong! Bấm nút dưới để tải ngay. Bản PDF cũng đã gửi vào email (xem cả mục Quảng cáo / Spam).</p>
    <a class="ie-tai" href="#" target="_blank" rel="noopener" hidden>Tải ebook (PDF) ngay &rarr;</a>
    <a class="ie-sp-sau" href="{{SP_LINK}}" hidden>
      <span class="ie-sp-ten">{{SP_TEN}}</span>
      <span class="ie-sp-loai">{{SP_LOAI}}</span>
      <span class="ie-sp-xem">Xem chi tiết và giá &rarr;</span>
    </a>
    <p class="ie-err" role="alert" hidden>Gửi chưa được &mdash; thử lại giúp mình nhé.</p>
    <button class="ie-no" type="button">Không, cảm ơn</button>
    <div class="ie-sp">
      <span class="ie-sp-hay">hoặc</span>
      <a class="ie-sp-lien" href="{{SP_LINK}}">
        <span class="ie-sp-ten">{{SP_TEN}}</span>
        <span class="ie-sp-loai">{{SP_LOAI}}</span>
        <span class="ie-sp-xem">Xem chi tiết và giá &rarr;</span>
      </a>
    </div>
    <p class="ie-note">Khi bấm gửi, bạn đồng ý để NOVA (Công ty CP TMDV ACME) dùng email/số Zalo để gửi ebook và thực đơn theo <a href="https://example.com/chinh-sach-bao-mat.html" target="_blank" rel="noopener">Chính sách dữ liệu</a>. Nội dung chia sẻ kiến thức ẩm thực, không thay thế tư vấn y khoa.</p>
  </div>
</div>
<style>
#novaExit[hidden]{display:none!important}
/* Thuộc tính hidden bị các luật display bên dưới đè (vd .ie-form{display:flex}) nên phải ép một
   luật chung: thiếu nó thì màn ĐÃ GỬI vẫn hiện ô email và nút 'Đang gửi...' — lỗi có sẵn, trước
   đây pop-up tự đóng sau 3,4 giây nên không ai kịp thấy. */
#novaExit [hidden]{display:none!important}
#novaExit{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(18,38,31,.55);opacity:0;transition:opacity .25s ease}
#novaExit.ie-show{opacity:1}
#novaExit .ie-card{position:relative;background:#fff;width:100%;max-width:430px;border-radius:22px;padding:34px 26px 22px;text-align:center;box-shadow:0 24px 70px rgba(16,24,40,.28);transform:translateY(14px) scale(.98);transition:transform .28s cubic-bezier(.2,.8,.25,1);font-family:var(--font-sans,'Manrope',system-ui,sans-serif)}
#novaExit.ie-show .ie-card{transform:none}
#novaExit .ie-card::before{content:"";position:absolute;top:0;left:0;right:0;height:5px;border-radius:22px 22px 0 0;background:linear-gradient(90deg,#A8D254,#4BC0AB)}
#novaExit .ie-x{position:absolute;top:12px;right:14px;border:none;background:none;font-size:26px;line-height:1;color:#98a2b3;cursor:pointer}
#novaExit .ie-x:hover{color:#475467}
#novaExit .ie-ico{width:38px;height:38px;color:#2E8975;margin:2px auto 8px;display:block}
#novaExit .ie-tag{display:inline-block;font-weight:700;font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:#2E8975}
#novaExit h3{font-family:var(--font-display,'Cormorant Garamond',serif);font-weight:700;font-size:1.6rem;line-height:1.12;margin:8px 0 8px;color:#12261f}
#novaExit p{color:#667085;font-size:1rem;margin:0 auto 16px;max-width:340px;line-height:1.5}
#novaExit p strong{color:#2E8975}
#novaExit .ie-form{display:flex;flex-direction:column;gap:10px;max-width:340px;margin:0 auto}
#novaExit .ie-email,#novaExit .ie-sdt{border:1px solid #d0d5dd;border-radius:12px;padding:14px 16px;font-size:1rem;font-family:inherit;outline:none}
#novaExit .ie-sdt{font-size:.92rem}
#novaExit .ie-email:focus,#novaExit .ie-sdt:focus{border-color:#4BC0AB;box-shadow:0 0 0 3px rgba(75,192,171,.16)}
#novaExit .ie-honey{display:none}
#novaExit .ie-btn{border:none;border-radius:12px;padding:14px;font-size:1rem;font-weight:700;color:#fff;background:linear-gradient(135deg,#2E8975,#4BC0AB);cursor:pointer;font-family:inherit}
#novaExit .ie-btn:disabled{opacity:.6;cursor:default}
#novaExit .ie-dy{display:flex;align-items:flex-start;gap:8px;text-align:left;font-size:.8rem;color:#667085;line-height:1.4;cursor:pointer;margin:0}
#novaExit .ie-dy input{width:15px;height:15px;flex:none;margin:2px 0 0;accent-color:#2E6B2D}
#novaExit .ie-note a{color:#2E6B2D;text-decoration:underline}
#novaExit .ie-ok{color:#2E8975;font-weight:600;margin:6px auto 0}
#novaExit .ie-tai{display:block;max-width:340px;margin:12px auto 0;border-radius:12px;padding:14px;font-size:1rem;font-weight:700;color:#fff;background:#1F4D1F;text-decoration:none}
#novaExit .ie-tai:hover{background:#2E6B2D}
#novaExit .ie-err{color:#d92d20;font-weight:600;margin:6px auto 0}
#novaExit .ie-no{border:none;background:none;color:#98a2b3;font-size:.9rem;text-decoration:underline;cursor:pointer;margin-top:12px;font-family:inherit}
#novaExit .ie-note{color:#98a2b3;font-size:.74rem;margin:12px auto 0;max-width:340px;line-height:1.4}
#novaExit .ie-sp{margin-top:14px;padding-top:14px;border-top:1px solid #eef0f3}
#novaExit .ie-sp-hay{display:block;color:#98a2b3;font-size:.76rem;margin-bottom:8px}
#novaExit .ie-sp-lien,#novaExit .ie-sp-sau{display:block;text-decoration:none;border:1px solid #e6e6da;border-radius:14px;padding:11px 14px;background:#fafbfa;transition:border-color .18s ease,background .18s ease}
#novaExit .ie-sp-lien:hover,#novaExit .ie-sp-sau:hover{border-color:#A8D254;background:#f5faee}
#novaExit .ie-sp-sau{margin-top:12px}
#novaExit .ie-sp-ten{display:block;color:#12261f;font-weight:700;font-size:.95rem}
#novaExit .ie-sp-loai{display:block;color:#667085;font-size:.78rem;margin-top:2px}
#novaExit .ie-sp-xem{display:block;color:#2E6B2D;font-weight:700;font-size:.82rem;margin-top:6px}
@media (prefers-reduced-motion: reduce){#novaExit,#novaExit .ie-card{transition:none}}
</style>
<script>
(function(){
  // Đã ĐỂ EMAIL rồi thì không bao giờ hiện lại. Đã đóng mà chưa để email thì nghỉ 7 ngày —
  // bản cũ ghi cờ '1' và khoá VĨNH VIỄN, ai lỡ thấy một lần là cả đời không thấy lại (đo 21/08
  // trên máy CEO: cờ đang là '1' nên mọi bài đều im). Cờ cũ dạng '1' coi như đã hết hạn.
  try{ if(localStorage.getItem('nova_lead_ok')) return;
       var daXem=localStorage.getItem('nova_exit_v1')||'';
       var moc=/^\\d{10,}$/.test(daXem)?parseInt(daXem,10):0;
       if(moc && Date.now()-moc < 7*864e5) return; }catch(e){}
  // Quà đổi từ "cẩm nang" sang ebook 100 món (03/09/2026): 367 phiên blog/tuần mà cẩm nang thu 0,
  // trong khi ebook đã 313 lượt tải. Đi qua /api/ebook-lead để khách nhận LINK TẢI NGAY + email +
  // (nếu để số) vào máy chia sale — cùng cửa với landing, không dựng đường thứ hai.
  var ENDPOINT='https://ops-hub.example.com/api/ebook-lead';
  var el=document.getElementById('novaExit'); if(!el) return;
  var shown=false, done=false;
  function open(){ if(shown) return; shown=true; try{localStorage.setItem('nova_exit_v1',String(Date.now()));}catch(e){}
    el.hidden=false; requestAnimationFrame(function(){el.classList.add('ie-show');});
    var i=el.querySelector('.ie-email'); if(i) setTimeout(function(){try{i.focus();}catch(e){}},60); }
  function close(){ el.classList.remove('ie-show'); setTimeout(function(){el.hidden=true;},260); }
  el.querySelector('.ie-x').addEventListener('click',close);
  el.querySelector('.ie-no').addEventListener('click',close);
  el.addEventListener('click',function(e){ if(e.target===el) close(); });
  document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&!el.hidden) close(); });
  // BA CỬA MỞ, ai tới trước mở trước. Bản cũ đòi cuộn quá 50% VÀ đủ 25 giây CÙNG LÚC — trên bài
  // dài 11.000px thì gần như không ai chạm tới, người đọc trôi mất mà chưa thấy gì.
  //   1. chuột rời mép trên (định thoát)  2. đọc tới 60% bài  3. ở lại 40 giây VÀ đã cuộn 20%
  // Điều kiện cuộn 20% ở cửa 3 là CỐ Ý: người mở tab rồi bỏ đó không đáng để đốt lượt hiện duy nhất.
  function tyLe(){ var h=document.documentElement; return h.scrollTop/((h.scrollHeight-h.clientHeight)||1); }
  document.addEventListener('mouseout',function(e){ if(!e.relatedTarget && e.clientY<=0) open(); });
  var duGio=false;
  setTimeout(function(){ duGio=true; if(tyLe()>=0.2) open(); }, 40000);
  window.addEventListener('scroll',function(){ var r=tyLe();
    if(r>=0.6) open(); else if(duGio && r>=0.2) open(); },{passive:true});
  el.querySelector('.ie-form').addEventListener('submit',function(ev){ ev.preventDefault(); if(done) return;
    var email=(el.querySelector('.ie-email').value||'').trim();
    var sdt=(el.querySelector('.ie-sdt').value||'').replace(/[^\\d+]/g,''); if(sdt.indexOf('+84')===0) sdt='0'+sdt.slice(3);
    var honey=(el.querySelector('.ie-honey').value||'').trim();
    var btn=el.querySelector('.ie-btn'), ok=el.querySelector('.ie-ok'), err=el.querySelector('.ie-err'); err.hidden=true;
    if(!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(email)){ err.textContent='Email chưa đúng — kiểm tra lại giúp mình.'; err.hidden=false; return; }
    if(sdt && !/^0(3|5|7|8|9)\\d{8}$/.test(sdt)){ err.textContent='Số Zalo chưa đúng — số di động Việt Nam 10 chữ số, hoặc để trống.'; err.hidden=false; return; }
    // NĐ 330/2026: ghi lại đúng câu chữ đồng ý khách đã thấy — [x]/[ ] theo ô "nhận thêm", dòng cơ sở luôn [x] vì bấm gửi là đồng ý.
    var dyCb=el.querySelector('.ie-dy-cb'), dyTin=!!(dyCb&&dyCb.checked), dyLbl=el.querySelector('.ie-dy span'), dyNote=el.querySelector('.ie-note');
    var dongY={tinTuVan:dyTin,vanBan:(dyTin?'[x] ':'[ ] ')+(dyLbl?dyLbl.textContent.replace(/\\s+/g,' ').trim():'')+' | [x] '+(dyNote?dyNote.textContent.replace(/\\s+/g,' ').trim():''),phienBan:'v1-2026-09-04'};
    btn.disabled=true; btn.textContent='Đang gửi…';
    var cmp='';try{cmp=new URLSearchParams(location.search).get('utm_campaign')||'';}catch(e){}var src='exit:'+((location.pathname.split('/').pop()||'blog').replace(/\\.html$/,''))+(cmp?'|'+cmp:'');
    fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email,sdt:sdt,ten:'',source:src,dongY:dongY,_honey:honey})})
      .then(function(r){ return r.json().catch(function(){return {ok:r.ok};}); })
      .then(function(j){ if(!j||j.ok===false) throw (j&&j.error)||0;
        done=true; try{localStorage.setItem('nova_lead_ok','1');}catch(e){}
        el.querySelector('.ie-form').hidden=true; el.querySelector('.ie-note').hidden=true;
        var spSau=el.querySelector('.ie-sp-sau'), spTruoc=el.querySelector('.ie-sp'), tai=el.querySelector('.ie-tai');
        if(spTruoc) spTruoc.hidden=true;
        ok.hidden=false;
        if(tai&&j.link){ tai.href=j.link; tai.hidden=false; }
        // Vừa nhận quà là lúc thiện cảm cao nhất — mời xem sản phẩm ngay dưới nút tải. KHÔNG tự
        // đóng nữa: người ta cần bấm nút tải, đóng hộ là mất quà.
        if(spSau) spSau.hidden=false; })
      .catch(function(l){ btn.disabled=false; btn.textContent='Nhận ebook miễn phí →'; err.textContent=(typeof l==='string'&&l)?l:'Gửi chưa được — thử lại giúp mình nhé.'; err.hidden=false; });
  });
})();
</script>`;

export function taoPopup(spSlug: string, goc = "../"): string {
  const sp = SP_POPUP[spSlug] || SP_POPUP["san-pham-a-protein"];
  const slug = SP_POPUP[spSlug] ? spSlug : "san-pham-a-protein";
  return EXIT_POPUP_MAU
    .replace(/\{\{SP_LINK\}\}/g, `${goc}shop/?sp=${slug}`)
    .replace(/\{\{SP_TEN\}\}/g, sp.ten)
    .replace(/\{\{SP_LOAI\}\}/g, sp.loai);
}
