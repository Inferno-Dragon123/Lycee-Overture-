<script setup lang="ts">
import type {Card} from '#shared/domain/catalog';
import {categoryLabels} from '#shared/domain/catalog';
import {strategyStyleCss,type StrategyTextStyle,type StrategySnapshot} from '#shared/domain/strategy';
const props=defineProps<{reference:any;cards:Record<string,Card>;snapshots:Record<string,StrategySnapshot>;printing?:boolean;origin?:string;textStyle?:StrategyTextStyle}>();
defineEmits<{card:[code:string]}>();
const refData=computed(()=>props.reference),deck=computed(()=>props.snapshots[refData.value?.snapshotId]);
const card=computed(()=>props.cards[refData.value?.code]);
const externalHost=computed(()=>{try{return new URL(refData.value?.url).hostname;}catch{return '外部资料';}});
const failed=ref<Record<string,boolean>>({});
const url=(path:string)=>(props.origin||'')+path;
</script>
<template>
  <div class="strategy-reference" :data-reference-kind="refData?.kind" :style="strategyStyleCss(textStyle)">
    <template v-if="refData?.kind==='card'">
      <figure v-if="card" class="strategy-card artwork">
        <a :href="url('/cards/'+card.code)" @click="!printing&&($event.preventDefault(),$emit('card',card.code))"><img v-if="!failed[card.code]" :src="card.img" :alt="card.name+' '+card.code" :loading="printing?'eager':'lazy'" @error="failed[card.code]=true" /><span v-else class="artwork-failed">▧ {{ card.code }} · 卡图暂不可用</span></a>
        <figcaption :style="strategyStyleCss(textStyle)"><strong>{{ card.name }}</strong><small>{{ card.code }}</small><a :href="url('/cards/'+card.code)" @click="!printing&&($event.preventDefault(),$emit('card',card.code))">查看完整效果</a></figcaption>
      </figure><p v-else>卡牌资料暂不可用 · {{ refData.code }}</p>
    </template>
    <div v-else-if="refData?.kind==='gallery'" class="strategy-card-gallery"><figure v-for="code in refData.codes" :key="code"><a :href="url('/cards/'+code)" @click="!printing&&($event.preventDefault(),$emit('card',code))"><img v-if="cards[code]&&!failed[code]" :src="cards[code].img" :alt="cards[code].name" :loading="printing?'eager':'lazy'" @error="failed[code]=true" /><span v-else class="artwork-failed">▧ {{ code }}</span></a><figcaption :style="strategyStyleCss(textStyle)">{{ cards[code]?.name||code }}<small>{{ code }}</small></figcaption></figure></div>
    <template v-else-if="refData?.kind==='deck'">
      <p v-if="!deck||deck.unavailable" class="reading-note">来源卡组已撤回或暂不可读取，此处暂不展示构筑。</p>
      <details v-else :open="printing||undefined" class="strategy-deck"><summary><strong>{{ deck.name }}</strong><span>{{ Object.values(deck.quantities).reduce((a,b)=>a+b,0) }}张 · {{ Object.keys(deck.quantities).length }}种</span><small>构筑作者：{{ deck.author }} · 引用时快照</small></summary>
        <a v-if="deck.sourceUrl" :href="url(deck.sourceUrl)">查看原卡组 ↗</a><div class="strategy-deck-grid"><figure v-for="(count,code) in deck.quantities" :key="code"><a :href="url('/cards/'+code)" @click="!printing&&($event.preventDefault(),$emit('card',String(code)))"><img v-if="cards[code]&&!failed[code]" :src="cards[code].img" :alt="cards[code].name" :loading="printing?'eager':'lazy'" @error="failed[code]=true" /><span v-else class="artwork-failed">▧ {{ code }}</span></a><figcaption :style="strategyStyleCss(textStyle)">{{ cards[code]?.name||code }}<small>{{ code }} × {{ count }}</small></figcaption></figure></div>
      </details>
    </template>
    <a v-else-if="refData?.kind==='external'" class="strategy-external" :style="{color:'inherit',textDecoration:'none',...strategyStyleCss(textStyle)}" :href="refData.url" target="_blank" rel="noopener noreferrer"><strong :style="strategyStyleCss(textStyle)">{{ refData.title||refData.url }}</strong><span :style="strategyStyleCss(textStyle)">{{ refData.description }}</span><small :style="strategyStyleCss(textStyle)">{{ externalHost }} ↗</small></a>
  </div>
</template>
