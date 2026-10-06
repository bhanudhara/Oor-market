import { useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ArrowDownRight, ArrowUpRight, BadgeIndianRupee, Boxes, ChartNoAxesCombined, Check, Clock3, Leaf, LogOut, MapPin, PackagePlus, ShieldCheck, Sprout, Store, Truck } from 'lucide-react';
import { changeSellerBid, commitFarmerLot, createFarmerListing } from '../features/market/marketSlice.js';

const money = (value) => `Rs ${Number(value).toLocaleString('en-IN')}`;

export default function RoleDashboard({ user, onSignOut }) {
  const dispatch = useDispatch();
  const { data, loading, saving, error } = useSelector((state) => state.market);
  const [listingOpen, setListingOpen] = useState(false);
  const [bid, setBid] = useState('');
  const [listing, setListing] = useState({ name: user.displayName, village: '', crop: 'Tomato', availableKg: '', grade: 'A' });
  const farmers = data?.farmers ?? [];
  const sellers = data?.sellers ?? [];
  const myListings = farmers.filter((farmer) => farmer.ownerUserId === user.id || farmer.id === user.profileId);
  const mySeller = sellers.find((seller) => seller.id === user.profileId);
  const matchingSellers = mySeller ? sellers.filter((seller) => seller.crop === mySeller.crop) : [];
  const bestBid = (crop) => Math.max(0, ...sellers.filter((seller) => seller.crop === crop).map((seller) => seller.bidPerKg));
  const farmerKg = myListings.reduce((sum, farmer) => sum + farmer.availableKg, 0);
  const farmerPotential = myListings.reduce((sum, farmer) => sum + farmer.availableKg * bestBid(farmer.crop), 0);
  const networkKg = farmers.reduce((sum, farmer) => sum + farmer.availableKg, 0);
  const totalCommitted = data?.summary.committedKg ?? 0;
  const roleTitles = { farmer: 'Farmer workspace', seller: 'Seller workspace', admin: 'Market administration' };
  const RoleIcon = user.role === 'farmer' ? Sprout : user.role === 'seller' ? Store : ShieldCheck;

  async function submitListing(event) {
    event.preventDefault();
    const result = await dispatch(createFarmerListing({ ...listing, availableKg: Number(listing.availableKg) }));
    if (createFarmerListing.fulfilled.match(result)) {
      setListing({ ...listing, availableKg: '' });
      setListingOpen(false);
    }
  }

  async function commitBestOffer(farmer) {
    const seller = sellers.filter((candidate) => candidate.crop === farmer.crop && candidate.filledKg < candidate.capacityKg).sort((first, second) => second.bidPerKg - first.bidPerKg)[0];
    if (!seller) return;
    const quantityKg = Math.min(farmer.availableKg, seller.capacityKg - seller.filledKg);
    await dispatch(commitFarmerLot({ farmerId: farmer.id, sellerId: seller.id, quantityKg }));
  }

  async function updateBid(event) {
    event.preventDefault();
    if (!mySeller) return;
    const result = await dispatch(changeSellerBid({ sellerId: mySeller.id, bidPerKg: Number(bid) }));
    if (changeSellerBid.fulfilled.match(result)) setBid('');
  }

  return <div className="workspace-shell">
    <aside className="workspace-rail">
      <a className="workspace-brand" href="#dashboard"><span><Leaf size={20} /></span><b>oor<small>market link</small></b></a>
      <div className="workspace-label">SIGNED IN AS</div>
      <div className="workspace-role"><RoleIcon size={16} /><span>{user.role}</span></div>
      <div className="rail-market"><MapPin size={14} /><span>Thanjavur network</span></div>
      <div className="rail-bottom"><span className="rail-live" /><span>PostgreSQL connected</span></div>
    </aside>
    <main className="workspace-main">
      <header className="workspace-topbar"><div><span className="topbar-overline">OOR MARKET LINK</span><span className="topbar-divider">/</span><strong>{roleTitles[user.role]}</strong></div><div className="user-menu"><span className="user-avatar">{user.displayName.slice(0, 1).toUpperCase()}</span><span className="user-meta"><b>{user.displayName}</b><small>{user.email}</small></span><button className="signout-button" onClick={onSignOut} aria-label="Sign out"><LogOut size={16} /><span>Sign out</span></button></div></header>
      <div className="workspace-content">
        {user.role === 'farmer' && <>
          <section className="dashboard-heading"><div><span className="dashboard-kicker"><Sprout size={13} />FARMER DASHBOARD</span><h1>Your harvest, {user.displayName.split(' ')[0]}.</h1><p>Track your crop listings and choose the best nearby offer.</p></div><button className="action-button" onClick={() => setListingOpen(!listingOpen)}><PackagePlus size={16} />{listingOpen ? 'Close form' : 'Add a harvest'}</button></section>
          <MetricGrid metrics={[
            { label: 'Available to sell', value: `${farmerKg} kg`, detail: `${myListings.length} active listings`, icon: Sprout, tone: 'green' },
            { label: 'Best nearby price', value: money(Math.max(0, ...myListings.map((farmer) => bestBid(farmer.crop)))), detail: 'per kg for your crops', icon: BadgeIndianRupee, tone: 'gold' },
            { label: 'Potential at best bid', value: money(farmerPotential), detail: 'before any transport costs', icon: ChartNoAxesCombined, tone: 'blue' },
          ]} />
          {listingOpen && <section className="form-panel"><PanelTitle eyebrow="NEW LISTING" title="Add produce to your harvest" /><form className="listing-form" onSubmit={submitListing}><label>Village<input value={listing.village} onChange={(event) => setListing({ ...listing, village: event.target.value })} placeholder="Your village" required /></label><label>Produce<select value={listing.crop} onChange={(event) => setListing({ ...listing, crop: event.target.value })}>{['Tomato', 'Onion', 'Brinjal', 'Potato', 'Chilli'].map((crop) => <option key={crop}>{crop}</option>)}</select></label><label>Available weight (kg)<input type="number" min="1" step="1" value={listing.availableKg} onChange={(event) => setListing({ ...listing, availableKg: event.target.value })} required /></label><label>Grade<select value={listing.grade} onChange={(event) => setListing({ ...listing, grade: event.target.value })}><option value="A">Grade A</option><option value="B">Grade B</option></select></label><button type="submit" className="action-button" disabled={saving}><Check size={15} />Publish listing</button></form></section>}
          <div className="dashboard-columns"><section className="data-panel"><PanelTitle eyebrow="YOUR PRODUCE" title="Active harvests" /><div className="listing-stack">{loading ? <p className="muted-copy">Loading your harvests…</p> : myListings.length ? myListings.map((farmer) => {
            const buyer = sellers.filter((seller) => seller.crop === farmer.crop && seller.filledKg < seller.capacityKg).sort((first, second) => second.bidPerKg - first.bidPerKg)[0];
            return <article className="harvest-card" key={farmer.id}><div className="produce-avatar"><Leaf size={17} /></div><div className="harvest-main"><strong>{farmer.crop}</strong><span>{farmer.availableKg} kg available · Grade {farmer.grade}</span><small>{farmer.village} · Harvest {farmer.harvest.toLowerCase()}</small></div><div className="offer-summary"><span>Top local bid</span><b>{buyer ? `${money(buyer.bidPerKg)}/kg` : 'No buyer yet'}</b><small>{buyer?.name ?? 'Check back later'}</small></div><button className="compact-action" disabled={!buyer || saving} onClick={() => commitBestOffer(farmer)}>{buyer ? 'Accept best offer' : 'No buyer'}<ArrowUpRight size={14} /></button></article>;
          }) : <EmptyState text="You have no active harvests yet." />}</div></section>
          <section className="data-panel offer-panel"><PanelTitle eyebrow="NEARBY BUYERS" title="Offers for your crops" />{sellers.filter((seller) => myListings.some((farmer) => farmer.crop === seller.crop)).sort((first, second) => second.bidPerKg - first.bidPerKg).map((seller) => <div className="offer-row" key={seller.id}><span className="offer-icon"><Store size={15} /></span><span className="offer-buyer"><b>{seller.name}</b><small>{seller.market}</small></span><span className="offer-price"><b>{money(seller.bidPerKg)}</b><small>/ kg</small></span></div>)}{!sellers.some((seller) => myListings.some((farmer) => farmer.crop === seller.crop)) && <EmptyState text="Local buyers appear here when you list produce." />}</section></div>
        </>}

        {user.role === 'seller' && <>
          <section className="dashboard-heading"><div><span className="dashboard-kicker"><Store size={13} />SELLER DASHBOARD</span><h1>Good to see you, {user.displayName.split(' ')[0]}.</h1><p>Manage your buying capacity and compete for nearby produce.</p></div></section>
          {mySeller ? <>
            <MetricGrid metrics={[
              { label: 'Your load capacity', value: `${mySeller.capacityKg} kg`, detail: mySeller.market, icon: Truck, tone: 'green' },
              { label: 'Still to fill', value: `${mySeller.capacityKg - mySeller.filledKg} kg`, detail: `${mySeller.filledKg} kg committed`, icon: Boxes, tone: 'gold' },
              { label: 'Your current bid', value: `${money(mySeller.bidPerKg)}/kg`, detail: mySeller.crop, icon: BadgeIndianRupee, tone: 'blue' },
            ]} />
            <section className="bid-panel"><div><span className="dashboard-kicker">COMPETE FOR LOCAL SUPPLY</span><h2>Update your {mySeller.crop.toLowerCase()} bid</h2><p>Farmers see the highest nearby offer first.</p></div><form className="bid-form" onSubmit={updateBid}><label><span>Rs per kg</span><input type="number" min="1" max="10000" step="0.5" value={bid} placeholder={mySeller.bidPerKg} onChange={(event) => setBid(event.target.value)} required /></label><button className="action-button" disabled={saving}>Publish bid<ArrowUpRight size={14} /></button></form></section>
            <section className="data-panel seller-supply"><PanelTitle eyebrow={`${mySeller.crop.toUpperCase()} SUPPLY NEARBY`} title="Farmer harvests" /><div className="supply-table"><div className="supply-head"><span>FARMER</span><span>VILLAGE</span><span>READY</span><span>GRADE</span></div>{farmers.filter((farmer) => farmer.crop === mySeller.crop && farmer.availableKg > 0).map((farmer) => <div className="supply-row" key={farmer.id}><strong>{farmer.name}</strong><span>{farmer.village}</span><span>{farmer.availableKg} kg</span><span>Grade {farmer.grade}</span></div>)}</div></section>
          </> : <EmptyState text="No seller profile is linked to this account." />}
        </>}

        {user.role === 'admin' && <>
          <section className="dashboard-heading"><div><span className="dashboard-kicker"><ShieldCheck size={13} />ADMIN DASHBOARD</span><h1>Network overview.</h1><p>Monitor supply, buyers, and direct-market commitments.</p></div></section>
          <MetricGrid metrics={[
            { label: 'Registered farmers', value: data?.summary.farmerCount ?? 0, detail: `${networkKg} kg listed now`, icon: Sprout, tone: 'green' },
            { label: 'Active sellers', value: data?.summary.sellerCount ?? 0, detail: `${data?.summary.marketCount ?? 0} markets`, icon: Store, tone: 'gold' },
            { label: 'Moved direct', value: `${totalCommitted} kg`, detail: 'kept out of long-haul transit', icon: ArrowDownRight, tone: 'blue' },
          ]} />
          <div className="dashboard-columns admin-columns"><section className="data-panel"><PanelTitle eyebrow="NETWORK SUPPLY" title="Farmer listings" /><div className="admin-list">{farmers.map((farmer) => <div className="admin-row" key={farmer.id}><span className="produce-avatar"><Leaf size={15} /></span><span><b>{farmer.name}</b><small>{farmer.village} · {farmer.crop}</small></span><strong>{farmer.availableKg} kg</strong><span className={`status-tag ${farmer.availableKg ? 'status-open' : 'status-filled'}`}>{farmer.availableKg ? 'Available' : 'Committed'}</span></div>)}</div></section><section className="data-panel"><PanelTitle eyebrow="BUYER LOADS" title="Capacity and bids" />{sellers.map((seller) => <div className="admin-seller" key={seller.id}><div><b>{seller.name}</b><small>{seller.market} · {seller.crop}</small></div><span>{money(seller.bidPerKg)}/kg</span><strong>{seller.filledKg}/{seller.capacityKg} kg</strong></div>)}</section></div>
        </>}
        {error && <div className="dashboard-error" role="alert">{error}</div>}
        <footer className="workspace-footer"><span>Oor Market Link <i />Local produce network</span><span><span className="connected-dot" />Connected to PostgreSQL</span></footer>
      </div>
    </main>
  </div>;
}

function MetricGrid({ metrics }) {
  return <section className="role-metrics">{metrics.map(({ label, value, detail, icon: Icon, tone }) => <article className="role-metric" key={label}><div className="metric-top"><span>{label}</span><i className={`metric-icon ${tone}`}><Icon size={17} /></i></div><strong>{value}</strong><small>{detail}</small></article>)}</section>;
}

function PanelTitle({ eyebrow, title }) {
  return <div className="panel-title"><span>{eyebrow}</span><h2>{title}</h2></div>;
}

function EmptyState({ text }) {
  return <div className="role-empty"><Clock3 size={18} /><span>{text}</span></div>;
}