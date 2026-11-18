/** Keep each seat independent, including a returning guest's second course. */
export function restaurantTrayTickets(info, { replaying = [], pendingAccepts = [], trackedId = null } = {}) {
  const tickets = [];
  for (const party of info.parties) {
    if (party.status === 'arriving' || replaying.includes(party.id)) continue;
    for (const member of party.members) {
      const order = member.order;
      if (!order) continue;
      const pending = pendingAccepts.includes(order.id);
      const waiting = order.status === 'requested' && !pending;
      if (!waiting && !pending && order.id !== trackedId) continue;
      tickets.push({
        id: order.id,
        recipe: order.recipe,
        table: party.table + 1,
        seat: member.seat === 0 ? '左座' : '右座',
        course: order.courses > 1 ? ` · 第 ${order.course} 餐` : '',
        commission: !!info.dailyCommission && !info.dailyCommission.completed && order.recipe.category === info.dailyCommission.category,
        state: pending ? 'pending' : waiting ? 'requested' : 'accepted',
      });
    }
  }
  return tickets.sort((a, b) => a.table - b.table || Number(a.seat === '右座') - Number(b.seat === '右座'));
}

export function createRestaurantOrderTray(host, { food }) {
  host.innerHTML = `<details class="rt-tray">
    <summary><span>接单簿</span><b class="rt-count" hidden></b><i aria-hidden="true"></i></summary>
    <section class="rt-sheet" aria-label="餐厅接单簿">
      <header><strong>待接订单</strong><small class="rt-page"></small><button type="button" class="rt-commission" data-r-tab="commission">今日委托 ›</button></header>
      <div class="rt-ticket">
        <button type="button" class="rt-step rt-prev" aria-label="上一份订单">‹</button>
        <div class="rt-dish" aria-hidden="true"></div>
        <div class="rt-copy"><strong></strong><small></small></div>
        <button type="button" class="rt-accept" data-r-action="kitchen-accept">接单</button>
        <button type="button" class="rt-step rt-next" aria-label="下一份订单">›</button>
      </div>
      <p class="rt-empty">暂无待接订单</p>
    </section>
  </details>`;
  const get = selector => host.querySelector(selector);
  const details = get('details'), summary = get('summary'), count = get('.rt-count');
  const ticketRow = get('.rt-ticket'), page = get('.rt-page'), empty = get('.rt-empty');
  const previous = get('.rt-prev'), next = get('.rt-next'), accept = get('.rt-accept');
  const art = get('.rt-dish'), name = get('.rt-copy strong'), seat = get('.rt-copy small');
  let tickets = [], currentId = null, trackedId = null, blocked = false, recipeId = null;
  let lastInfo = null, lastOptions = {}, rendered = null;

  function paint() {
    const requests = tickets.filter(ticket => ticket.state === 'requested').length;
    const index = Math.max(0, tickets.findIndex(ticket => ticket.id === currentId));
    const ticket = tickets[index];
    currentId = ticket?.id ?? null;
    const signature = JSON.stringify([requests, tickets.length, index, ticket?.id, ticket?.recipe.id,
      ticket?.recipe.name, ticket?.table, ticket?.seat, ticket?.course, ticket?.commission, ticket?.state, blocked]);
    if (rendered === signature) return;
    rendered = signature;
    count.hidden = !requests;
    count.textContent = String(requests);
    summary.setAttribute('aria-label', `接单簿，${requests} 份待接订单`);
    const navFocused = ticketRow.contains(host.ownerDocument.activeElement);
    const acceptFocused = host.ownerDocument.activeElement === accept;
    empty.hidden = !!ticket;
    ticketRow.hidden = !ticket;
    page.textContent = ticket ? `${index + 1} / ${tickets.length}` : '';
    if (!ticket) {
      delete accept.dataset.rOrderId;
      accept.disabled = true;
      if (navFocused && details.open) summary.focus({ preventScroll: true });
      return;
    }

    previous.hidden = next.hidden = tickets.length < 2;
    if (recipeId !== ticket.recipe.id) {
      recipeId = ticket.recipe.id;
      art.innerHTML = food(recipeId);
    }
    name.textContent = ticket.recipe.name;
    const location = `${ticket.table} 号桌 · ${ticket.seat}${ticket.course}${ticket.commission ? ' · 今日委托' : ''}`;
    seat.textContent = location;
    accept.dataset.rOrderId = ticket.id;
    accept.dataset.state = ticket.state;
    accept.disabled = blocked || ticket.state !== 'requested';
    accept.textContent = { requested: '接单', pending: '待同步', accepted: '已接单' }[ticket.state];
    accept.setAttribute('aria-label', `${location}，${ticket.recipe.name}，${accept.textContent}`);
    if (navFocused && details.open && (acceptFocused && accept.disabled || tickets.length === 1 && !acceptFocused)) {
      (tickets.length > 1 ? next : summary).focus({ preventScroll: true });
    }
  }

  function sync(info, options = {}) {
    lastInfo = info;
    lastOptions = options;
    blocked = !!options.blocked;
    tickets = restaurantTrayTickets(info, { ...options, trackedId });
    paint();
  }

  function turn(direction) {
    if (tickets.length < 2) return;
    const index = tickets.findIndex(ticket => ticket.id === currentId);
    currentId = tickets[(index + direction + tickets.length) % tickets.length].id;
    trackedId = null;
    sync(lastInfo, lastOptions);
  }

  previous.addEventListener('click', () => turn(-1));
  next.addEventListener('click', () => turn(1));
  accept.addEventListener('click', () => {
    // Pin this ticket through acknowledgement so a double tap cannot accept
    // the following guest's order. The normal restaurant action handles saving.
    if (!accept.disabled) trackedId = accept.dataset.rOrderId;
  });
  details.addEventListener('toggle', () => {
    if (!details.open) {
      currentId = null;
      trackedId = null;
      if (lastInfo) sync(lastInfo, lastOptions);
    }
  });
  return {
    sync,
    isOpen: () => details.open,
    close({ restoreFocus = false } = {}) {
      details.open = false;
      currentId = trackedId = null;
      if (restoreFocus) summary.focus({ preventScroll: true });
    },
  };
}
