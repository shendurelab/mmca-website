import { colors } from './color.js';
import { genes } from './genes.js';
import { background_mutant } from './backgorund_mutant.js';
import { mutant_map } from './mutant_map.js';


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
  legendVisible = false;

  constructor(plot_id, background_id, mutant_id, trajectory_id, annotation_id, gene_id, gene_w_id, legend_id, loading_id, apply_id, title_id) {
    this.plot_id = plot_id;
    this.background_selector = document.getElementById(background_id);
    this.mutant_selector = document.getElementById(mutant_id);
    this.trajectory_selector = document.getElementById(trajectory_id);
    this.annotation_selector = document.getElementById(annotation_id);
    this.gene_selector = document.getElementById(gene_id);
    this.gene_wrapper = document.getElementById(gene_w_id);
    this.legend_toggle = document.getElementById(legend_id);
    this.colors = colors;
    this.loading_div = document.getElementById(loading_id);
    this.apply = document.getElementById(apply_id);
    this.title = document.getElementById(title_id);
    console.log('finished construction');
  }

  get plot_id() {
    return this.plot_id;
  }

  get plot() {
    return this.plot;
  }

  async create_plot() {
    this.#add_mutant_options();
    this.#update_title();
    console.log('creating plot');
    let traces = await this.#generate_traces();
    console.log('done generating traces')

    let layout = {
      scene: {
        xaxis: {
          // visible: false
          showticklabels: false,
          title: { text: "UMAP 1" }
        },
        yaxis: {
          // visible: false
          showticklabels: false,
          title: { text: "UMAP 2" }
        },
        zaxis: {
          // visible: false
          showticklabels: false,
          title: { text: "UMAP 3" }
        }
      },
      height: 600,
      margin: { l: 0, r: 0, b: 0, t: 0 },
      legend: { bgcolor: 'rgba(255,255,255,0.6)', yanchor: "top", y: 0.95, xanchor: "right", x: 0.99 },
      showlegend: this.legendVisible
    };

    await Plotly.newPlot(this.plot_id, traces, layout, { responsive: true })
    this.loading_div.classList.remove('lds-ellipsis');
    this.plot = document.getElementById(this.plot_id);
    this.#add_listeners();
  }

  async update_plot() {
    console.log('updating');
    let old_traces_length = this.traces.length;
    try {
      await this.#generate_traces();
    } catch (err) {
      document.getElementById("error-message").innerHTML = err;
      return
    }
    Plotly.deleteTraces(this.plot_id, [...Array(old_traces_length).keys()]);
    this.#update_title();
    Plotly.addTraces(this.plot_id, [...this.traces]);
    this.loading_div.classList.remove('lds-ellipsis');
  }

  async #generate_traces() {
    this.loading_div.classList.add('lds-ellipsis');
    let data;
    try {
      data = await this.#fetch_data();
    } catch (err) {
      this.loading_div.classList.remove('lds-ellipsis');
      throw err
    }
    console.log(data);
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

    for (let item in unique) {
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

    if (this.detail == 'gene' & !this.gene_selector.value) {
      throw "Please Select a Gene"
    }

    let params = {
      "background": this.background_selector.value,
      "trajectory": this.trajectory_selector.value,
      "mutant": this.mutant_selector.value,
      "annotation": this.annotation_selector.value,
      "gene": this.detail == 'gene' ? this.gene_selector.value : ''
    }

    console.log('fetching data');
    const res = await fetch('/mmca_v2/data?' + new URLSearchParams(params));
    if (!res.ok) {
      throw "Database Error"
    }
    return res.json();
  }

  #add_listeners() {
    this.background_selector.onchange = () => {
      this.#add_mutant_options();
      $(this.apply).addClass("button-primary");
    };

    this.annotation_selector.onchange = () => {
      if (this.annotation_selector.value.includes('gene_expression')) {
        $(this.gene_wrapper).removeClass('hide')
        $(this.gene_wrapper).addClass('slide-right')
        this.detail = "gene"
        $(this.apply).addClass("button-primary");
      } else {
        this.detail = "annotation";
        $(this.gene_wrapper).addClass('hide')
        $(this.gene_wrapper).removeClass('slide-right')
        $(this.apply).addClass("button-primary");
      }
    };

    this.mutant_selector.onchange = () => {
      $(this.apply).addClass("button-primary");
    };

    this.gene_selector.oninput = () => this.#generate_genes_field_autocomplete();

    this.legend_toggle.addEventListener('click', () => {
      Plotly.relayout(this.plot_id, { 'showlegend': !this.legendVisible })
      this.legendVisible = !this.legendVisible;
      $(this.legend_toggle).toggleClass("button-primary");
    });

    this.apply.addEventListener('click', () => {
      document.getElementById("error-message").innerHTML = "";
      this.update_plot();
      $(this.apply).removeClass("button-primary");
    });
  }

  #generate_genes_field_autocomplete() {
    this.#closeAllGeneLists();
    let text = this.gene_selector.value;

    let gene_list = document.createElement('div');
    gene_list.setAttribute('class', 'autocomplete-list');
    this.gene_selector.parentNode.parentNode.insertBefore(gene_list, this.gene_selector.parentNode.nextSibling);

    for (const gene of genes) {
      if (gene.toLowerCase().includes(text.toLowerCase()) && text) {
        let matching_gene = document.createElement('div');
        matching_gene.innerHTML = gene;
        matching_gene.addEventListener('click', () => {
          this.gene_selector.value = gene;
          this.#closeAllGeneLists();
          this.detail = "gene";
          $(this.apply).addClass("button-primary");
        });
        gene_list.appendChild(matching_gene);
      }
    }
    if (!gene_list.hasChildNodes()) {
      this.#closeAllGeneLists();
    }
  }

  #closeAllGeneLists() {
    const gene_lists = document.getElementsByClassName('autocomplete-list');
    for (const list of gene_lists) {
      list.parentNode.removeChild(list);
    }
  }

  #update_title() {
    let colored_by
    if (this.detail == 'gene') {
      colored_by = `${this.gene_selector.value} gene expression`
    } else {
      colored_by = `${this.annotation_selector.value.replace('_', ' ')}`
    }
    this.title.innerHTML = `Mouse cells in the ${this.trajectory_selector.value}
                            with ${this.background_selector.value} background
                            and ${mutant_map[this.mutant_selector.value] ? mutant_map[this.mutant_selector.value] : this.mutant_selector.value} mutation
                            colored by ${colored_by}`
  }

  #add_mutant_options() {
    this.mutant_selector.innerHTML = '';
    background_mutant[this.background_selector.value].forEach(mutant => {
      let opt = document.createElement('option');
      opt.value = mutant;
      opt.innerHTML = mutant_map[mutant] ? mutant_map[mutant] : mutant
      this.mutant_selector.appendChild(opt);
    });
    this.mutant_selector.value = background_mutant[this.background_selector.value][0];
  }

  #unpack(data, key) { return data.map(row => row[key]) }

  static sync_camera(Plot_1, Plot_2) {
    let cameraChange = false;

    Plot_1.plot.on('plotly_relayout', () => {
      if (!cameraChange) {
        Plotly.relayout(Plot_2.plot, { 'scene.camera': Plot_1.plot.layout.scene.camera })
          .then(() => { cameraChange = false });
      }
      cameraChange = true;
    });
  }
}
