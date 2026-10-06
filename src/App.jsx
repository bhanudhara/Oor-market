import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ArrowDownRight, ArrowUpRight, Bell, Check, ChevronDown, CircleHelp, Clock3, HandCoins, Leaf, MapPin, Menu, Plus, Search, Sprout, Store, Truck, X } from 'lucide-react';
import { changeSellerBid, clearMarketError, commitFarmerLot, createFarmerListing, fetchMarket } from './features/market/marketSlice.js';

const cropImages = {
  Tomato: 'https://images.unsplash.com/photo-1546094096-0df4bcaaa337?auto=format&fit=crop&w=180&q=80',
  Onion: 'https://images.unsplash.com/photo-1508747703725-719777637510?auto=format&fit=crop&w=180&q=80',
  Brinjal: 'https://images.unsplash.com/photo-1566385101042-1a0aa0c1268c?auto=format&fit=crop&w=180&q=80',
};
const money = (amount) => `Rs ${Number(amount).toLocaleString('en-IN')}`;
const displayDate = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

export default function App() {
  const dispatch = useDispatch();
  const { data, loading, saving, error } = useSelector((state) => state.market);
  const [tab, setTab] = useState('Marketplace');
  const [crop, setCrop] = useState('All produce');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => { dispatch(fetchMarket()); }, [dispatch]);

  const farmers = data?.farmers ?? [];
  const sellers = data?.sellers ?? [];
  const crops = useMemo(() => ['All produce', ...new Set(farmers.map((farmer) => farmer.crop))], [farmers]);
  const bestPrices = useMemo(() => sellers.reduce((prices, seller) => ({ ...prices, [seller.crop]: Math.max(prices[seller.crop] ?? 0, seller.bidPerKg) }), {}), [sellers]);
  const visibleFarmers = farmers.filter((farmer) => farmer.availableKg > 0 && (crop === 'All produce' || farmer.crop === crop) && `${farmer.name} ${farmer.village} ${farmer.crop}`.toLowerCase().includes(search.trim().toLowerCase()));

  function openCommit(farmer) {
    const buyer = sellers.filter((seller) => seller.crop === farmer.crop && seller.filledKg < seller.capacityKg).sort((a, b) => b.bidPerKg - a.bidPerKg)[0];
    if (buyer) setModal({ type: 'commit', farmer, seller: buyer });
  }
  function closeModal() { setModal(null); dispatch(clearMarketError()); }
  async function submitThunk(thunk, values) { const result = await dispatch(thunk(values)); if (thunk.fulfilled.match(result)) closeModal(); }

  return <div className="app-shell">
    <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
      <a className="brand" href="#home"><span className="brand-mark"><Leaf size={21} /></span><span><strong>oor</strong><small>market link</small></span></a>
      <div className="side-label">YOUR WORKSPACE</div>
      <nav className="main-nav" aria-label="Main navigation">
        <button className={`nav-link ${tab === 'Marketplace' ? 'active' : ''}`} onClick={() => { setTab('Marketplace'); setMenuOpen(false); }}><Store size={18} />Marketplace<span className="nav-dot" /></button>
        <button className={`nav-link ${tab === 'My activity' ? 'active' : ''}`} onClick={() => { setTab('My activity'); setMenuOpen(false); }}><Clock3 size={18} />My activity</button>
      </nav>
      <div className="side-markets"><div className="side-label">NEARBY MARKETS <b>{data?.markets.length ?? '—'}</b></div>{(data?.markets ?? []).map((market, index) => <div className="market-link" key={market}><span className={`market-pin pin-${index}`}><MapPin size={13} /></span>{market.replace(' Market', '')}</div>)}</div>
      <div className="sidebar-bottom"><div className="help-card"><CircleHelp size={18} /><span><strong>Need a hand?</strong><small>Talk to our field team</small></span><ArrowUpRight size={14} /></div><div className="profile"><span className="profile-avatar">AM</span><span><strong>Arun M.</strong><small>Market coordinator</small></span><ChevronDown size={15} /></div></div>
    </aside>

    <main className="main-area" id="home">
      <header className="topbar"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMenuOpen(!menuOpen)}><Menu size={20} /></button><div className="breadcrumb"><span>District network</span><i>/</i><strong>Thanjavur</strong><ChevronDown size={14} /></div><div className="top-actions"><span className="live"><i />Market open</span><button className="icon-button notification" aria-label="Notifications"><Bell size={18} /><i /></button><span className="top-date">{displayDate}</span></div></header>

      {tab === 'Marketplace' ? <div className="page-content">
        <section className="welcome"><div><div className="eyebrow"><i />DIRECT FROM THE FIELD</div><h1>Good morning, Arun<span>.</span></h1><p>A better route from the farm to your market.</p></div><button className="primary-button" onClick={() => setModal({ type: 'listing' })}><Plus size={17} />List produce</button></section>
        <section className="stats-grid">
          <article className="stat-card stat-feature"><div className="stat-label">Produce ready nearby <span className="stat-icon leaf-icon"><Sprout size={18} /></span></div><strong>{loading ? '—' : (data?.summary.availableKg ?? 0).toLocaleString()}<small>kg</small></strong><div className="stat-foot"><span className="green-text"><ArrowUpRight size={14} />Fresh today</span><span>across {data?.summary.farmerCount ?? 0} farmers</span></div></article>
          <article className="stat-card"><div className="stat-label">Buyers filling loads <span className="stat-icon truck-icon"><Truck size={17} /></span></div><strong>{data?.summary.sellerCount ?? 0}<small>buyers</small></strong><div className="stat-foot"><span className="orange-text"><i />{data?.summary.marketCount ?? 0} local markets</span><span>within 10 km</span></div></article>
          <article className="stat-card"><div className="stat-label">Moved direct today <span className="stat-icon money-icon"><HandCoins size={17} /></span></div><strong>{data?.summary.committedKg ?? 0}<small>kg</small></strong><div className="stat-foot"><span className="blue-text"><ArrowDownRight size={14} />No long-haul trip</span><span>and counting</span></div></article>
        </section>

        <section className="market-layout"><div className="market-column">
          <div className="section-heading"><div><span className="kicker">THE LOCAL HARVEST</span><h2>Ready to move</h2></div><button className="text-button" onClick={() => { setCrop('All produce'); setSearch(''); }}>View all <ArrowUpRight size={15} /></button></div>
          <div className="toolbar"><label className="search-box"><Search size={17} /><input aria-label="Search crop, farmer or village" placeholder="Search crop, farmer or village" value={search} onChange={(event) => setSearch(event.target.value)} />{search && <button aria-label="Clear search" onClick={() => setSearch('')}><X size={14} /></button>}</label><label className="filter"><span className="sr-only">Filter by produce</span><select value={crop} onChange={(event) => setCrop(event.target.value)}>{crops.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={14} /></label></div>
          <div className="produce-list">{loading ? <div className="empty-state">Loading the local harvest…</div> : visibleFarmers.length === 0 ? <div className="empty-state"><Sprout size={22} /><strong>No matching produce yet</strong><span>Try another search or list a harvest.</span></div> : visibleFarmers.map((farmer) => {
            const buyer = sellers.filter((seller) => seller.crop === farmer.crop && seller.filledKg < seller.capacityKg).sort((a, b) => b.bidPerKg - a.bidPerKg)[0];
            return <article className="produce-row" key={farmer.id}><img src={cropImages[farmer.crop] ?? cropImages.Tomato} alt={`${farmer.crop} harvest`} /><div className="produce-info"><div className="crop-line"><h3>{farmer.crop}</h3><span className={`grade grade-${farmer.grade.toLowerCase()}`}>Grade {farmer.grade}</span></div><span className="farmer-line">{farmer.name}<i />{farmer.village}</span><span className="harvest"><Clock3 size={12} />Harvest {farmer.harvest.toLowerCase()}</span></div><div className="quantity"><strong>{farmer.availableKg}<small> kg</small></strong><span>available</span></div><div className="price"><span>Best local bid</span><strong>{money(bestPrices[farmer.crop] ?? 0)}<small>/kg</small></strong><span>{buyer ? `${buyer.distanceKm} km away` : 'No buyer nearby'}</span></div><button className="join-button" disabled={!buyer || saving} onClick={() => openCommit(farmer)}>{buyer ? 'Join a load' : 'No buyer'}<ArrowUpRight size={14} /></button></article>;
          })}</div>
          <div className="note-strip"><span className="note-check"><Check size={13} /></span><span>Small harvests welcome. Buyers combine nearby lots to fill their load.</span><b>100–150 kg per buyer</b></div>
        </div>

        <aside className="right-column"><section className="buyers-panel"><div className="panel-heading"><div><span className="kicker">LOCAL DEMAND</span><h2>Buyers nearby</h2></div><button className="icon-button more-button" aria-label="Buyer list options">···</button></div><div className="buyer-list">{[...sellers].sort((a, b) => b.bidPerKg - a.bidPerKg).map((seller) => <article className="buyer-row" key={seller.id}><div className={`buyer-avatar buyer-${seller.crop.toLowerCase()}`}>{seller.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</div><div className="buyer-main"><div className="buyer-name"><strong>{seller.name}</strong><span><MapPin size={11} />{seller.distanceKm} km</span></div><small>{seller.market}</small><div className="capacity"><i><b style={{ width: `${Math.min(100, seller.filledKg / seller.capacityKg * 100)}%` }} /></i><span>{seller.filledKg}/{seller.capacityKg} kg</span></div></div><div className="buyer-bid"><strong>{money(seller.bidPerKg)}</strong><span>/ kg</span><button onClick={() => setModal({ type: 'bid', seller })}>Edit bid</button></div></article>)}</div><button className="add-harvest" onClick={() => setModal({ type: 'listing' })}><Plus size={15} />Add a harvest to the network</button></section>

          <section className="route-card"><div className="route-top"><span><Truck size={17} /></span><b>SHORTER ROUTE</b><ArrowUpRight size={15} /></div><h3>Keep the journey local.</h3><p>Every nearby load filled means less produce travelling out to Chennai and back.</p><div className="route-visual"><div className="route-node"><span className="farm-node"><Sprout size={14} /></span><small>Farm</small></div><div className="route-dashes"><i /><i /><i /><i /><i /></div><span className="distance">4.2 km</span><div className="route-dashes"><i /><i /><i /><i /><i /></div><div className="route-node"><span className="market-node"><Store size={14} /></span><small>Market</small></div></div><div className="route-foot"><span><i />Direct pickup</span><span>No city detour</span></div></section>

          <section className="activity-panel"><div className="activity-heading"><h3>Market pulse</h3><span><i />LIVE</span></div>{(data?.activity ?? []).slice(0, 3).map((item) => <div className="activity-item" key={item.id}><i className={`activity-marker marker-${item.type}`} /><span>{item.message}<small>{item.time}</small></span></div>)}</section>
        </aside></section>
        <footer className="page-footer"><span>Oor Market Link <i />Built for the local harvest</span><span><i />Data updates as loads fill</span></footer>
      </div> : <div className="page-content activity-page"><section className="welcome"><div><div className="eyebrow"><i />YOUR NETWORK</div><h1>Market activity<span>.</span></h1><p>Every listing, bid and load commitment in one place.</p></div><button className="primary-button" onClick={() => setTab('Marketplace')}><Store size={16} />Back to marketplace</button></section><section className="full-activity">{(data?.activity ?? []).map((item) => <div className="full-activity-item" key={item.id}><i className={`activity-marker marker-${item.type}`} /><div><strong>{item.message}</strong><small>{item.time}</small></div><span>{item.type}</span></div>)}</section></div>}
    </main>

    {error && <div className="toast" role="alert"><span>{error}</span><button onClick={() => dispatch(clearMarketError())} aria-label="Dismiss error"><X size={16} /></button></div>}
    {modal && <MarketModal modal={modal} sellers={sellers} saving={saving} onClose={closeModal} onSubmit={(thunk, values) => submitThunk(thunk, values)} />}
  </div>;
}

function MarketModal({ modal, sellers, saving, onClose, onSubmit }) {
  const [quantity, setQuantity] = useState(Math.min(modal.farmer?.availableKg ?? 1, (modal.seller?.capacityKg ?? 1) - (modal.seller?.filledKg ?? 0)));
  const [sellerId, setSellerId] = useState(modal.seller?.id ?? '');
  const [bid, setBid] = useState(modal.seller?.bidPerKg ?? '');
  const [listing, setListing] = useState({ name: '', village: '', crop: 'Tomato', availableKg: '', grade: 'A' });
  const selectedSeller = sellers.find((seller) => seller.id === sellerId);
  const maxQuantity = Math.min(modal.farmer?.availableKg ?? 1, selectedSeller ? selectedSeller.capacityKg - selectedSeller.filledKg : 1);
  const title = modal.type === 'commit' ? 'Add to a buyer’s load' : modal.type === 'bid' ? 'Update your bid' : 'List a harvest';
  const subtitle = modal.type === 'commit' ? `${modal.farmer.name} has ${modal.farmer.availableKg} kg of ${modal.farmer.crop.toLowerCase()} ready.` : modal.type === 'bid' ? `Set a competitive price for ${modal.seller.crop.toLowerCase()}.` : 'Let nearby sellers know what you have ready.';

  function submit(event) {
    event.preventDefault();
    if (modal.type === 'commit') onSubmit(commitFarmerLot, { farmerId: modal.farmer.id, sellerId, quantityKg: Number(quantity) });
    else if (modal.type === 'bid') onSubmit(changeSellerBid, { sellerId: modal.seller.id, bidPerKg: Number(bid) });
    else onSubmit(createFarmerListing, { ...listing, availableKg: Number(listing.availableKg) });
  }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-head"><span>{modal.type === 'commit' ? <Truck size={18} /> : modal.type === 'bid' ? <HandCoins size={18} /> : <Sprout size={18} />}</span><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={18} /></button></div><h2 id="modal-title">{title}</h2><p className="modal-subtitle">{subtitle}</p><form onSubmit={submit}>
    {modal.type === 'commit' && <><label className="form-label">Choose a nearby buyer<select value={sellerId} onChange={(event) => setSellerId(event.target.value)} required>{sellers.filter((seller) => seller.crop === modal.farmer.crop && seller.filledKg < seller.capacityKg).sort((a, b) => b.bidPerKg - a.bidPerKg).map((seller) => <option key={seller.id} value={seller.id}>{seller.name} · {money(seller.bidPerKg)}/kg · {seller.capacityKg - seller.filledKg} kg space</option>)}</select></label><label className="form-label">Quantity to commit<span className="input-suffix"><input type="number" min="1" max={maxQuantity} step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} required /><span>kg</span></span><small>Up to {maxQuantity} kg fits this buyer’s remaining capacity.</small></label><div className="estimate"><span>Estimated farmer payout</span><strong>{money(Number(quantity || 0) * (selectedSeller?.bidPerKg ?? modal.seller.bidPerKg))}</strong></div></>}
    {modal.type === 'bid' && <><label className="form-label">Your offer per kilogram<span className="input-suffix"><input type="number" min="1" max="10000" step="0.5" value={bid} onChange={(event) => setBid(event.target.value)} required /><span>Rs / kg</span></span></label><div className="bid-note"><HandCoins size={16} />Higher local bids help farmers keep more of the sale.</div></>}
    {modal.type === 'listing' && <><div className="form-grid"><label className="form-label">Farmer name<input value={listing.name} onChange={(event) => setListing({ ...listing, name: event.target.value })} placeholder="Your name" required /></label><label className="form-label">Village<input value={listing.village} onChange={(event) => setListing({ ...listing, village: event.target.value })} placeholder="Village" required /></label></div><div className="form-grid"><label className="form-label">Produce<select value={listing.crop} onChange={(event) => setListing({ ...listing, crop: event.target.value })}><option>Tomato</option><option>Onion</option><option>Brinjal</option><option>Potato</option><option>Chilli</option><option>Other</option></select></label><label className="form-label">Quantity<span className="input-suffix"><input type="number" min="1" step="1" value={listing.availableKg} onChange={(event) => setListing({ ...listing, availableKg: event.target.value })} placeholder="60" required /><span>kg</span></span></label></div><label className="form-label">Produce grade<select value={listing.grade} onChange={(event) => setListing({ ...listing, grade: event.target.value })}><option value="A">Grade A</option><option value="B">Grade B</option></select></label></>}
    <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button" disabled={saving}>{saving ? 'Saving…' : modal.type === 'commit' ? 'Confirm load' : modal.type === 'bid' ? 'Publish bid' : 'List produce'}<ArrowUpRight size={15} /></button></div>
  </form></section></div>;
}