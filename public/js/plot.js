import {colors} from './color.js';
import {genes} from './genes.js';

export default class Plot {
  plot;
  plot_id;
  background_selector;
  trajectory_selector;
  annotation_selector;
  gene_selector;
  legend_toggle;
  detail = "annotation";
  traces = [];
  colors = {};

  constructor(plot_id, background_id, trajectory_id, annotation_id, gene_id, legend_id) {
    this.plot_id = plot_id;
    this.background_selector = document.getElementById(background_id);
    this.trajectory_selector = document.getElementById(trajectory_id);
    this.annotation_selector = document.getElementById(annotation_id);
    this.gene_selector = document.getElementById(gene_id);
    this.legend_toggle = document.getElementById(legend_id);
    this.colors = colors;
    this.legendVisible = true;
    console.log('finished construction');
  }

  get plot_id() {
    return this.plot_id;
  }

  get plot() {
    return this.plot;
  }

  async create_plot() {
    console.log('creating plot');
    let traces = await this.#generate_traces();
    console.log('done generating traces')

    let layout = {
      height: 600,
      margin: {l:0 ,r:0, b:0, t:0},
      legend: {yanchor:"top", y:0.95, xanchor:"right", x:0.99}
    };

    await Plotly.newPlot(this.plot_id, traces, layout, {responsive: true})
    this.plot = document.getElementById(this.plot_id);
    this.#add_listeners();
    this.#add_legend_toggle();
  }

  async update_plot() {
    console.log('updating');
    let old_traces_length = this.traces.length;
    await this.#generate_traces();
    Plotly.deleteTraces(this.plot_id, [...Array(old_traces_length).keys()]);
    Plotly.addTraces(this.plot_id, [...this.traces]);
  }

  async #generate_traces() {
    let data = await this.#fetch_data();
    console.log("data retrieved");
    let filtered_data = [];
    let traces = [];
    let annotation = this.annotation_selector.value;
    let unique = [];
    let color = [];
    

    if (this.detail == "gene") {
      unique = ['expression'];
    } else if (annotation == 'total_mRNA') {
      unique = ['total_mRNA'];
    } else {
      unique = [...new Set(this.#unpack(data, annotation))];
    }

    for (let item in unique){
      if (annotation != 'total_mRNA' & this.detail != 'gene') {
        filtered_data = data.filter((el) => el[annotation] == unique[item]);
        color = this.colors[unique[item]];

      } else {
        filtered_data = data;
        color = this.#unpack(filtered_data, unique[item]);
      }

      let trace = {
          name: unique[item],
          x: this.#unpack(filtered_data, 'x'), y: this.#unpack(filtered_data, 'y'), z: this.#unpack(filtered_data, 'z'),
          mode: 'markers',
          marker: {
            size: 3,
            color: color,
            width: 0.1,
            opacity: 0.4,
            showscale: this.detail == "gene" || annotation == 'total_mRNA'
          },
          type: 'scatter3d',
          hovertemplate: "Trace",
        };
      traces.push(trace);
    }
    this.traces = traces;
    return traces;
  }

  async #fetch_data() {
    let params = {
      "background": this.background_selector.value,
      "trajectory": this.trajectory_selector.value
    }

    if (this.detail == 'annotation') {
      params[this.detail] = this.annotation_selector.value
    } else if (this.detail == 'gene') {
      params[this.detail] = this.gene_selector.value
    }

    try {
      console.log('fetching data');
      const res = await fetch('/mmca_v2/data?' + new URLSearchParams(params));
      return res.json();
      
    } catch (err) {
      console.error(err);
    }
  }

  #add_listeners() {
    this.background_selector.onchange = () => this.update_plot(this.detail);

    this.annotation_selector.onchange = () => {
      this.detail = "annotation";
      this.update_plot();
    };

    this.gene_selector.oninput = () => this.#generate_genes_field_autocomplete();
  }

  #generate_genes_field_autocomplete() {
    this.#closeAllGeneLists();
    let text = this.gene_selector.value;

    let gene_list = document.createElement('div');
    gene_list.setAttribute('class', 'autocomplete-list');
    this.gene_selector.parentNode.appendChild(gene_list);

    for (const gene of genes) {
      if (gene.toLowerCase().includes(text.toLowerCase()) && text) {
        let matching_gene = document.createElement('div');
        matching_gene.innerHTML = gene;
        matching_gene.addEventListener('click', () => {
          this.gene_selector.value = gene;
          this.#closeAllGeneLists();
          this.detail = "gene";
          this.update_plot();
        });
        gene_list.appendChild(matching_gene);
      }
    }
  }

  #add_legend_toggle() {
    this.legend_toggle.addEventListener('click', () => {
        Plotly.relayout(this.plot_id, {'showlegend': !this.legendVisible})
        this.legendVisible = !this.legendVisible;
        $(this.legend_toggle).toggleClass("button-primary");
    });
  }

  #closeAllGeneLists() {
    const gene_lists = document.getElementsByClassName('autocomplete-list');
    for (const list of gene_lists) {
      list.parentNode.removeChild(list);
    }
  }

  #unpack(data, key) {return data.map(row => row[key])}

  static sync_camera(Plot_1, Plot_2) {
    let cameraChange = false;

    Plot_1.plot.on('plotly_relayout', () => {
      if(!cameraChange) {
        Plotly.relayout(Plot_2.plot, {'scene.camera': Plot_1.plot.layout.scene.camera})
          .then(() => {cameraChange = false});
      }
      cameraChange = true;
    });
  }
}
