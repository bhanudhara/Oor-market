import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ArrowDownRight, ArrowUpRight, BadgeIndianRupee, Boxes, ChartNoAxesCombined, Check, Clock3, Leaf, LogOut, MapPin, PackagePlus, ShieldCheck, Sprout, Store, Truck } from 'lucide-react';
import { changeSellerBid, commitFarmerLot, createFarmerListing, fetchDeals, fetchMarket, saveUserLocation, updateFarmerListing, withdrawFarmerListing } from '../features/market/marketSlice.js';
import NearbyMap from './NearbyMap.jsx';
import './nearby.css';

const money = (value) => `Rs ${Number(value).toLocaleString('en-IN')}`;

export default function RoleDashboard({ user, onSignOut }) {
  const dispatch = useDispatch();
  const { data, loading, saving, error } = useSelector((state) => state.market);
  const deals = useSelector((state) => state.market.deals);
  const dealsLoading = useSelector((state) => state.market.dealsLoading);
  const [listingOpen, setListingOpen] = useState(false);
  const [radiusKm, setRadiusKm] = useState(10);
  const [currentLocation, setCurrentLocation] = useState({ latitude: user.latitude, longitude: user.longitude });
  const [locationStatus, setLocationStatus] = useState('');
  const [pendingOffer, setPendingOffer] = useState(null);
  const [editingFarmerId, setEditingFarmerId] = useState(null);
  const [withdrawFarmer, setWithdrawFarmer] = useState(null);
  const [bid, setBid] = useState('');
  const [listing, setListing] = useState({ name: user.displayName, village: '', crop: 'Tomato', availableKg: '', grade: 'A' });
  useEffect(() => { dispatch(fetchMarket(radiusKm)); }, [dispatch, radiusKm]);
  useEffect(() => { dispatch(fetchDeals()); }, [dispatch, user.id]);
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
    const listingData = { ...listing, availableKg: Number(listing.availableKg), radiusKm };
    const result = editingFarmerId
      ? await dispatch(updateFarmerListing({ ...listingData, farmerId: editingFarmerId }))
      : await dispatch(createFarmerListing(listingData));
    if ((editingFarmerId && updateFarmerListing.fulfilled.match(result)) || (!editingFarmerId && createFarmerListing.fulfilled.match(result))) {
      setListing({ ...listing, availableKg: '' });
      setListingOpen(false);
      setEditingFarmerId(null);
    }
  }

  function startOfferReview(farmer, selectedOffer = farmer.offers?.[0]) {
    const offer = selectedOffer;
    if (!offer || farmer.availableKg <= 0) return;
    const remainingKg = Math.max(0, offer.capacityKg - offer.filledKg);
    if (remainingKg <= 0) return;
    setPendingOffer({ farmerId: farmer.id, sellerId: offer.id, sellerName: offer.name, crop: farmer.crop, availableKg: farmer.availableKg, maxKg: Math.min(farmer.availableKg, remainingKg), quantityKg: Math.min(farmer.availableKg, remainingKg), pricePerKg: offer.bidPerKg });
  }

  async function confirmOffer() {
    if (!pendingOffer) return;
    const result = await dispatch(commitFarmerLot({ ...pendingOffer, quantityKg: Number(pendingOffer.quantityKg), radiusKm }));
    if (commitFarmerLot.fulfilled.match(result)) {
      setPendingOffer(null);
      dispatch(fetchDeals());
    }
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationStatus('Location is unavailable; choose your village instead.');
      return;
    }
    setLocationStatus('Requesting your location…');
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      const coordinates = { latitude: coords.latitude, longitude: coords.longitude };
      setListing((current) => ({ ...current, ...coordinates }));
      const saved = await dispatch(saveUserLocation(coordinates));
      setLocationStatus(saveUserLocation.fulfilled.match(saved) ? 'Current location saved for nearby search.' : 'Location selected for this listing.');
      dispatch(fetchMarket(radiusKm));
    }, () => setLocationStatus('Location permission was denied; choose your village instead.'), { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  }

  async function withdrawListing(farmerId) {
    const result = await dispatch(withdrawFarmerListing({ farmerId, radiusKm }));
    if (withdrawFarmerListing.fulfilled.match(result)) {
      setWithdrawFarmer(null);
      dispatch(fetchDeals());
    }
  }

  function beginEdit(farmer) {
    setEditingFarmerId(farmer.id);
    setListing({ name: farmer.name, village: farmer.village, crop: farmer.crop, availableKg: String(farmer.availableKg), grade: farmer.grade, latitude: farmer.latitude, longitude: farmer.longitude });
    setListingOpen(true);
    setWithdrawFarmer(null);
  }

  function exportAdminCsv() {
    const escapeCell = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const rows = [['Farmer', 'Village', 'Crop', 'Available kg', 'Best bid Rs/kg', 'Nearest buyer km'], ...farmers.map((farmer) => [farmer.name, farmer.village, farmer.crop, farmer.availableKg, farmer.bestBidPerKg ?? '', farmer.nearestBuyerDistanceKm ?? ''])];
    const content = rows.map((row) => row.map(escapeCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'oor-market-network.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  async function updateBid(event) {
    event.preventDefault();
    if (!mySeller) return;
    const result = await dispatch(changeSellerBid({ sellerId: mySeller.id, bidPerKg: Number(bid), radiusKm }));
    if (changeSellerBid.fulfilled.match(result)) setBid('');
  }

  return <div className={`workspace-shell ${user.role}-workspace`}>
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
          <section className="dashboard-heading"><div><span className="dashboard-kicker"><Sprout size={13} />FARMER DASHBOARD</span><h1>Your harvest, {user.displayName.split(' ')[0]}.</h1><p>Track your crop listings and choose the best nearby offer.</p></div><div className="dashboard-actions"><RadiusSelector radiusKm={radiusKm} onChange={setRadiusKm} /><button className="action-button" onClick={() => { setEditingFarmerId(null); setListingOpen(!listingOpen); }}><PackagePlus size={16} />{listingOpen ? 'Close form' : 'Add a harvest'}</button></div></section>
          <MetricGrid metrics={[
            { label: 'Available to sell', value: `${farmerKg} kg`, detail: `${myListings.length} active listings`, icon: Sprout, tone: 'green' },
            { label: 'Best nearby price', value: money(Math.max(0, ...myListings.map((farmer) => bestBid(farmer.crop)))), detail: 'per kg for your crops', icon: BadgeIndianRupee, tone: 'gold' },
            { label: 'Potential at best bid', value: money(farmerPotential), detail: 'before any transport costs', icon: ChartNoAxesCombined, tone: 'blue' },
          ]} />
          <NearbyMap role="farmer" origin={currentLocation} farmers={myListings} sellers={sellers} markets={data?.markets ?? []} deals={deals} radiusKm={radiusKm} />
          {listingOpen && <section className="form-panel"><PanelTitle eyebrow={editingFarmerId ? 'EDIT LISTING' : 'NEW LISTING'} title={editingFarmerId ? 'Update your harvest' : 'Add produce to your harvest'} /><form className="listing-form" onSubmit={submitListing}><label className="village-field">Village<input value={listing.village} onChange={(event) => setListing({ ...listing, village: event.target.value, latitude: undefined, longitude: undefined })} placeholder="Your village" required /></label><button type="button" className="location-button" onClick={useCurrentLocation}><MapPin size={14} />Use my current location</button><label>Produce<select value={listing.crop} onChange={(event) => setListing({ ...listing, crop: event.target.value })}>{['Tomato', 'Onion', 'Brinjal', 'Potato', 'Chilli'].map((crop) => <option key={crop}>{crop}</option>)}</select></label><label>Available weight (kg)<input type="number" min="1" step="1" value={listing.availableKg} onChange={(event) => setListing({ ...listing, availableKg: event.target.value })} required /></label><label>Grade<select value={listing.grade} onChange={(event) => setListing({ ...listing, grade: event.target.value })}><option value="A">Grade A</option><option value="B">Grade B</option></select></label><button type="submit" className="action-button" disabled={saving}><Check size={15} />{editingFarmerId ? 'Save changes' : 'Publish listing'}</button></form>{locationStatus && <p className="location-status" role="status">{locationStatus}</p>}</section>}
          <div className="dashboard-columns">
            <section className="data-panel">
              <PanelTitle eyebrow="YOUR PRODUCE" title="Active harvests" />
              <div className="listing-stack">
                {loading ? <LoadingState text="Loading your harvests…" /> : error ? <ErrorState text={error} /> : myListings.length ? myListings.map((farmer) => {
                  const offer = farmer.offers?.[0];
                  const canAccept = Boolean(offer) && farmer.availableKg > 0 && offer.capacityKg > offer.filledKg;
                  const committed = deals.some((deal) => deal.farmerId === farmer.id);
                  const canManage = farmer.availableKg > 0 && !committed;
                  return <div className="farmer-listing-block" key={farmer.id}>
                    <article className="harvest-card">
                      <div className="produce-avatar"><Leaf size={17} /></div>
                      <div className="harvest-main"><strong>{farmer.crop}</strong><span>{farmer.availableKg} kg available · Grade {farmer.grade}</span><small>{farmer.village} · Harvest {farmer.harvest.toLowerCase()}</small></div>
                      <div className="offer-summary"><span>Best net offer</span><b>{offer ? `${money(offer.netPricePerKg)}/kg` : 'No nearby buyer'}</b><small>{offer ? `${offer.name} · ${offer.distanceKm} km away` : `Within ${radiusKm} km`}</small></div>
                      <div className="harvest-actions">
                        <button className="compact-action" disabled={!canAccept || saving} onClick={() => startOfferReview(farmer)}>{canAccept ? 'Review offer' : 'Unavailable'}<ArrowUpRight size={14} /></button>
                        {canManage && <><button className="inline-text-button" onClick={() => beginEdit(farmer)}>Edit</button><button className="inline-text-button danger-text" onClick={() => setWithdrawFarmer(farmer)}>Withdraw</button></>}
                      </div>
                    </article>
                    {pendingOffer?.farmerId === farmer.id && <div className="offer-confirm-panel">
                      <div><span className="dashboard-kicker">CONFIRM BUYER</span><strong>{pendingOffer.sellerName}</strong><small>{pendingOffer.crop} · {money(pendingOffer.pricePerKg)}/kg</small></div>
                      <label>Weight (kg)<input type="number" min="1" max={pendingOffer.maxKg} step="1" value={pendingOffer.quantityKg} onChange={(event) => setPendingOffer({ ...pendingOffer, quantityKg: event.target.value })} /></label>
                      <div className="confirm-total"><small>Estimated total</small><strong>{money(Number(pendingOffer.quantityKg || 0) * pendingOffer.pricePerKg)}</strong></div>
                      <button className="action-button" onClick={confirmOffer} disabled={saving || Number(pendingOffer.quantityKg) < 1 || Number(pendingOffer.quantityKg) > pendingOffer.maxKg}>Confirm sale</button>
                      <button className="inline-text-button" onClick={() => setPendingOffer(null)}>Cancel</button>
                    </div>}
                    {withdrawFarmer?.id === farmer.id && <div className="withdraw-confirm"><span>Withdraw this uncommitted {farmer.crop.toLowerCase()} listing?</span><button className="inline-text-button danger-text" disabled={saving} onClick={() => withdrawListing(farmer.id)}>Confirm withdraw</button><button className="inline-text-button" onClick={() => setWithdrawFarmer(null)}>Keep listing</button></div>}
                  </div>;
                }) : <EmptyState text="You have no active harvests yet. Add one to find nearby buyers." />}
              </div>
            </section>
            <section className="data-panel offer-panel">
              <PanelTitle eyebrow="NEARBY BUYERS" title="Offers for your crops" />
              {loading ? <LoadingState text="Searching nearby buyers…" /> : error ? <ErrorState text={error} /> : myListings.flatMap((farmer) => (farmer.offers ?? []).map((offer) => ({ farmer, offer }))).length
                ? myListings.flatMap((farmer) => (farmer.offers ?? []).map((offer) => ({ farmer, offer }))).map(({ farmer, offer }) => <div className="offer-row" key={`${farmer.id}-${offer.id}`}><span className="offer-icon"><Store size={15} /></span><span className="offer-buyer"><b>{offer.name}</b><small>{farmer.crop} · {offer.distanceKm} km away</small></span><span className="offer-price"><b>{money(offer.netPricePerKg)}</b><small>/ kg net</small></span><button className="inline-text-button" disabled={farmer.availableKg <= 0 || offer.capacityKg <= offer.filledKg} onClick={() => startOfferReview(farmer, offer)}>Review</button></div>)
                : <EmptyState text={`No matching offers within ${radiusKm} km.`} />}
            </section>
          </div>
          <DealsPanel deals={deals} loading={dealsLoading} />
        </>}

        {user.role === 'seller' && <>
          <section className="dashboard-heading"><div><span className="dashboard-kicker"><Store size={13} />SELLER DASHBOARD</span><h1>Good to see you, {user.displayName.split(' ')[0]}.</h1><p>Manage your buying capacity and compete for nearby produce.</p></div><RadiusSelector radiusKm={radiusKm} onChange={setRadiusKm} /></section>
          {mySeller ? <>
            <MetricGrid metrics={[
              { label: 'Your load capacity', value: `${mySeller.capacityKg} kg`, detail: mySeller.market, icon: Truck, tone: 'green' },
              { label: 'Still to fill', value: `${mySeller.capacityKg - mySeller.filledKg} kg`, detail: `${mySeller.filledKg} kg committed`, icon: Boxes, tone: 'gold' },
              { label: 'Your current bid', value: `${money(mySeller.bidPerKg)}/kg`, detail: mySeller.crop, icon: BadgeIndianRupee, tone: 'blue' },
            ]} />
            <section className="bid-panel"><div><span className="dashboard-kicker">COMPETE FOR LOCAL SUPPLY</span><h2>Update your {mySeller.crop.toLowerCase()} bid</h2><p>Farmers see the highest nearby offer first.</p></div><form className="bid-form" onSubmit={updateBid}><label><span>Rs per kg</span><input type="number" min="1" max="10000" step="0.5" value={bid} placeholder={mySeller.bidPerKg} onChange={(event) => setBid(event.target.value)} required /></label><button className="action-button" disabled={saving}>Publish bid<ArrowUpRight size={14} /></button></form></section>
            <NearbyMap role="seller" origin={{ latitude: mySeller.latitude, longitude: mySeller.longitude }} farmers={farmers} sellers={sellers} markets={data?.markets ?? []} deals={deals} radiusKm={radiusKm} />
            <section className="data-panel seller-supply"><PanelTitle eyebrow={`${mySeller.crop.toUpperCase()} SUPPLY NEARBY`} title="Farmer harvests" /><p className="privacy-hint">Exact farm locations are shared only after an offer is accepted.</p>{loading ? <LoadingState text="Searching crop supply nearby…" /> : error ? <ErrorState text={error} /> : farmers.length === 0 ? <EmptyState text={`No matching harvests within ${radiusKm} km.`} /> : <><p className="table-scroll-hint">Swipe horizontally to see village, distance, and grade</p><div className="supply-table-scroll" tabIndex="0" role="region" aria-label="Nearby farmer supply, horizontally scrollable"><div className="supply-table"><div className="supply-head"><span>FARMER</span><span>VILLAGE</span><span>READY</span><span>DISTANCE</span><span>GRADE</span></div>{farmers.map((farmer) => <div className="supply-row" key={farmer.id}><strong>Nearby farmer</strong><span>{farmer.village}</span><span>{farmer.availableKg} kg</span><span>{farmer.distanceKm} km away</span><span>Grade {farmer.grade}</span></div>)}</div></div></>}</section>
            <DealsPanel deals={deals} loading={dealsLoading} />
          </> : <EmptyState text="No seller profile is linked to this account." />}
        </>}

        {user.role === 'admin' && <>
          <section className="dashboard-heading"><div><span className="dashboard-kicker"><ShieldCheck size={13} />ADMIN DASHBOARD</span><h1>Network overview.</h1><p>Monitor supply, buyers, and direct-market commitments.</p></div><button className="action-button" onClick={exportAdminCsv} disabled={loading}><ArrowDownRight size={15} />Export CSV</button></section>
          <MetricGrid metrics={[
            { label: 'Registered farmers', value: data?.summary.farmerCount ?? 0, detail: `${networkKg} kg listed now`, icon: Sprout, tone: 'green' },
            { label: 'Active sellers', value: data?.summary.sellerCount ?? 0, detail: `${data?.summary.marketCount ?? 0} markets`, icon: Store, tone: 'gold' },
            { label: 'Moved direct', value: `${totalCommitted} kg`, detail: 'kept out of long-haul transit', icon: ArrowDownRight, tone: 'blue' },
            { label: 'Average nearby distance', value: `${data?.summary.averageDistanceKm ?? 0} km`, detail: 'to best crop-matched offer', icon: MapPin, tone: 'green' },
            { label: 'Average best offer', value: `${money(data?.summary.averageBestPricePerKg ?? 0)}/kg`, detail: 'before transport cost', icon: BadgeIndianRupee, tone: 'gold' },
          ]} />
          <NearbyMap role="admin" origin={null} farmers={farmers} sellers={sellers} markets={data?.markets ?? []} radiusKm={50} />
          <div className="dashboard-columns admin-columns"><section className="data-panel"><PanelTitle eyebrow="NETWORK SUPPLY" title="Farmer listings" />{loading ? <LoadingState text="Loading network supply…" /> : error ? <ErrorState text={error} /> : farmers.length === 0 ? <EmptyState text="No farmer listings are available." /> : <div className="admin-list">{farmers.map((farmer) => <div className="admin-row" key={farmer.id}><span className="produce-avatar"><Leaf size={15} /></span><span><b>{farmer.name}</b><small>{farmer.village} · {farmer.crop}{Number.isFinite(farmer.nearestBuyerDistanceKm) ? ` · ${farmer.nearestBuyerDistanceKm} km to buyer` : ''}</small></span><strong>{farmer.availableKg} kg</strong><span className={`status-tag ${farmer.availableKg ? 'status-open' : 'status-filled'}`}>{farmer.availableKg ? 'Available' : 'Committed'}</span></div>)}</div>}</section><section className="data-panel"><PanelTitle eyebrow="BUYER LOADS" title="Capacity and bids" />{loading ? <LoadingState text="Loading buyer capacity…" /> : error ? <ErrorState text={error} /> : sellers.length === 0 ? <EmptyState text="No registered buyers are available." /> : sellers.map((seller) => <div className="admin-seller" key={seller.id}><div><b>{seller.name}</b><small>{seller.market} · {seller.crop}</small></div><span>{money(seller.bidPerKg)}/kg</span><strong>{seller.filledKg}/{seller.capacityKg} kg</strong></div>)}</section></div>
          <DealsPanel deals={deals} loading={dealsLoading} />
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

function LoadingState({ text }) {
  return <div className="role-loading" role="status"><span className="loading-spinner" />{text}</div>;
}

function ErrorState({ text }) {
  return <div className="role-error" role="alert">{text}</div>;
}

function RadiusSelector({ radiusKm, onChange }) {
  return <label className="radius-selector"><MapPin size={14} /><span>Radius</span><select value={radiusKm} onChange={(event) => onChange(Number(event.target.value))}>{[5, 10, 25, 50].map((radius) => <option key={radius} value={radius}>{radius} km</option>)}</select></label>;
}

function DealsPanel({ deals, loading }) {
  const error = useSelector((state) => state.market.error);
  return <section className="data-panel deals-panel"><PanelTitle eyebrow="ACCEPTED OFFERS" title="My deals" />{loading ? <LoadingState text="Loading deal history…" /> : error ? <ErrorState text={error} /> : deals.length === 0 ? <EmptyState text="Accepted offers will appear here." /> : <div className="deals-list">{deals.map((deal) => <article className="deal-row" key={deal.id}><span className="deal-crop"><Leaf size={15} /></span><span className="deal-main"><b>{deal.crop}</b><small>{deal.quantityKg} kg · {money(deal.pricePerKg)}/kg</small></span><strong>{money(deal.totalPrice)}</strong><span className="deal-status">{deal.status}</span></article>)}</div>}</section>;
}