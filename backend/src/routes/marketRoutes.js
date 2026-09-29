// backend/src/routes/marketRoutes.js
const express = require('express');
const axios = require('axios');
const router = express.Router();
const { getBinancePrice, getBinanceHomeMarkets } = require('../../services/tradeService');

const MARKET_SYMBOLS=["BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT","XRPUSDT","DOGEUSDT","ADAUSDT","TRXUSDT","AVAXUSDT","LINKUSDT","TONUSDT","LTCUSDT"];
const MARKET_CACHE_TTL_MS=5000;
const PRICE_CACHE_TTL_MS=1000;
const priceCache=new Map();
const priceInFlight=new Map();
let marketCache=null;
let marketInFlight=null;

async function getCachedHomeMarkets(){
  const now=Date.now();
  if(marketCache&&now-marketCache.timestamp<MARKET_CACHE_TTL_MS)return marketCache.rows;
  if(!marketInFlight){
    marketInFlight=getBinanceHomeMarkets(MARKET_SYMBOLS).then(rows=>{marketCache={rows,timestamp:Date.now()};return rows}).finally(()=>{marketInFlight=null});
  }
  return marketInFlight;
}
async function getCachedPrice(symbol){
  const now=Date.now(),cached=priceCache.get(symbol);
  if(cached&&now-cached.timestamp<PRICE_CACHE_TTL_MS)return cached.price;
  if(!priceInFlight.has(symbol)){
    const request=getBinancePrice(symbol).then(price=>{priceCache.set(symbol,{price,timestamp:Date.now()});return price}).finally(()=>priceInFlight.delete(symbol));
    priceInFlight.set(symbol,request);
  }
  return priceInFlight.get(symbol);
}

router.get('/market/home',async(req,res,next)=>{try{res.json({success:true,data:await getCachedHomeMarkets()})}catch(e){next(e)}});
router.get('/market/list',async(req,res,next)=>{try{res.json({success:true,data:await getCachedHomeMarkets()})}catch(e){next(e)}});
router.get('/market/price',async(req,res,next)=>{try{const symbol=String(req.query.symbol||'BTCUSDT').toUpperCase().trim();res.json({success:true,data:{symbol,price:await getCachedPrice(symbol)}})}catch(e){next(e)}});

router.get('/market/ticker',async(req,res,next)=>{
  try{
    const symbol=String(req.query.symbol||'BTCUSDT').toUpperCase().trim();
    if(!/^[A-Z0-9]{5,20}$/.test(symbol))return res.status(400).json({success:false,message:'Invalid market symbol'});
    const response=await axios.get('https://api.binance.com/api/v3/ticker/24hr',{params:{symbol},timeout:8000});
    const d=response.data||{};
    res.json({success:true,data:{symbol,price:Number(d.lastPrice||0),lastPrice:Number(d.lastPrice||0),highPrice:Number(d.highPrice||0),lowPrice:Number(d.lowPrice||0),volume:Number(d.volume||0),quoteVolume:Number(d.quoteVolume||0),priceChange:Number(d.priceChange||0),priceChangePercent:Number(d.priceChangePercent||0),openPrice:Number(d.openPrice||0),prevClosePrice:Number(d.prevClosePrice||0),eventTime:Date.now()}});
  }catch(e){next(e)}
});

router.get('/market/klines',async(req,res,next)=>{
  try{
    const symbol=String(req.query.symbol||'BTCUSDT').toUpperCase().trim();
    const interval=String(req.query.interval||'1m').trim();
    const limit=Math.max(1,Math.min(1000,Number(req.query.limit||300)));
    const allowed=['1s','1m','3m','5m','15m','30m','1h','2h','4h','6h','8h','12h','1d','3d','1w','1M'];
    if(!/^[A-Z0-9]{5,20}$/.test(symbol)||!allowed.includes(interval))return res.status(400).json({success:false,message:'Invalid market candle request'});
    const response=await axios.get('https://api.binance.com/api/v3/klines',{params:{symbol,interval,limit},timeout:10000});
    res.json({success:true,data:Array.isArray(response.data)?response.data:[]});
  }catch(e){next(e)}
});

module.exports=router;
